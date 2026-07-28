import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/lib/db';

// Read-only endpoint for Home Assistant (server-to-server, static bearer token).
// NOT gated by the login cookie: it authenticates with STAYS_API_TOKEN and is
// listed in middleware PUBLIC_PATHS so the session gate lets it through.
// Unlike GET /api/stays, this does NOT run sweepStaleStatuses — zero side effects.
export const dynamic = 'force-dynamic';

type StayRow = RowDataPacket & {
  id: number;
  name: string;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  arrival: string;    // 'YYYY-MM-DD' (db.ts dateStrings:true)
  departure: string;
  nights: number;
};

// 'unconfigured' = server env missing (500); true/false = client auth result (401)
function checkBearer(req: NextRequest): boolean | 'unconfigured' {
  const expected = process.env.STAYS_API_TOKEN ?? '';
  if (!expected) return 'unconfigured';
  const header = req.headers.get('authorization') ?? '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  // sha256 both sides so timingSafeEqual gets equal-length buffers (mirrors login route)
  const a = createHash('sha256').update(m[1]).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

function baseUrl(req: NextRequest): string {
  const env = process.env.STAYS_PUBLIC_URL;
  if (env) return env.replace(/\/+$/, '');
  const host  = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  return host ? `${proto}://${host}` : 'https://stays.noteworthynomads.com';
}

function shape(row: StayRow | undefined, base: string) {
  if (!row) return null;
  const location = [row.city, row.state].filter(Boolean).join(', ') || null;
  return {
    name:      row.name,
    location,
    latitude:  row.lat,   // number, or null when the stay has no coordinates yet
    longitude: row.lng,
    arrive:    row.arrival,
    depart:    row.departure,
    nights:    row.nights,
    url:       `${base}/stays/${row.id}`,
  };
}

export async function GET(request: NextRequest) {
  const auth = checkBearer(request);
  if (auth === 'unconfigured') {
    console.error('[GET /api/next-stay] STAYS_API_TOKEN is not set');
    return NextResponse.json({ error: 'API token not configured' }, { status: 500 });
  }
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const pool = getPool();
    const base = baseUrl(request);

    // Current: today within [arrival, departure], not cancelled.
    const [curRows] = await pool.query<StayRow[]>(
      `SELECT id, name, city, state, lat, lng, arrival, departure, nights
         FROM stays
        WHERE status <> 'Cancelled'
          AND arrival <= CURDATE()
          AND departure >= CURDATE()
        ORDER BY arrival ASC
        LIMIT 1`
    );
    const current = curRows[0];

    // Upcoming: arrival today-or-later, soonest first, excluding the current stay.
    const params: unknown[] = [];
    let exclude = '';
    if (current) { exclude = 'AND id <> ?'; params.push(current.id); }

    const [upRows] = await pool.query<StayRow[]>(
      `SELECT id, name, city, state, lat, lng, arrival, departure, nights
         FROM stays
        WHERE status <> 'Cancelled'
          AND arrival >= CURDATE()
          ${exclude}
        ORDER BY arrival ASC
        LIMIT 5`,
      params
    );

    const upcoming = upRows.map(r => shape(r, base));
    const next     = upcoming[0] ?? null;
    const generated_at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

    return NextResponse.json({ generated_at, current: shape(current, base), next, upcoming });
  } catch (err) {
    console.error('[GET /api/next-stay]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
