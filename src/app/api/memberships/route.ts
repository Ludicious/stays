import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { getPool } from '@/lib/db';

export async function GET(request: NextRequest) {
  const pool      = getPool();
  const activeOnly = request.nextUrl.searchParams.get('active') === 'true';

  try {
    const sql = activeOnly
      ? 'SELECT * FROM memberships WHERE active = TRUE ORDER BY name ASC'
      : 'SELECT * FROM memberships ORDER BY name ASC';
    const [rows] = await pool.query<RowDataPacket[]>(sql);
    return NextResponse.json(rows);
  } catch (err) {
    console.error('[memberships GET]', err);
    return NextResponse.json({ error: 'Failed to load memberships.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const pool = getPool();
  try {
    const body = await request.json() as Record<string, unknown>;
    const { name, annual_fee, savings_method, discount_percent, per_stay_value,
            discount_desc, affiliate_url, active, notes } = body;

    if (!name || !(name as string).trim()) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO memberships
         (name, annual_fee, savings_method, discount_percent, per_stay_value,
          discount_desc, affiliate_url, active, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        (name as string).trim(),
        annual_fee ?? 0,
        savings_method ?? 'none',
        discount_percent ?? null,
        per_stay_value ?? null,
        discount_desc ? (discount_desc as string).trim() || null : null,
        affiliate_url ? (affiliate_url as string).trim() || null : null,
        active !== false,
        notes ? (notes as string).trim() || null : null,
      ]
    );

    const insertId = result.insertId;
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM memberships WHERE id = ?', [insertId]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error('[memberships POST]', err);
    return NextResponse.json({ error: 'Failed to create membership.' }, { status: 500 });
  }
}
