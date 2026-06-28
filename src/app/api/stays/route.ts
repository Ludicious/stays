import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { getPool } from '@/lib/db';
import type { Stay } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const upcoming = searchParams.get('upcoming');
    const status   = searchParams.get('status');
    const limit    = searchParams.get('limit');

    const pool = getPool();
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (upcoming === 'true') {
      clauses.push('departure >= CURDATE()');
    }
    if (status) {
      clauses.push('status = ?');
      params.push(status);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    let sql = `SELECT * FROM stays ${where} ORDER BY arrival ASC`;

    if (limit) {
      sql += ' LIMIT ?';
      params.push(Number(limit));
    }

    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    return NextResponse.json(rows as Stay[]);
  } catch (err) {
    console.error('[GET /api/stays]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<Stay> & {
      name: string; arrival: string; departure: string; stay_type: string;
    };

    const { name, arrival, departure, stay_type } = body;
    if (!name || !arrival || !departure || !stay_type) {
      return NextResponse.json(
        { error: 'Missing required fields: name, arrival, departure, stay_type' },
        { status: 400 }
      );
    }

    const pool = getPool();
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO stays
         (name, city, state, country, full_address, lat, lng, place_id,
          arrival, departure, stay_type, hookup_type, site_category, membership_id, status,
          total_charged, deposit_paid, notes, phone, email, website)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        body.city          ?? null,
        body.state         ?? null,
        body.country       ?? 'USA',
        body.full_address  ?? null,
        body.lat           ?? null,
        body.lng           ?? null,
        body.place_id      ?? null,
        arrival,
        departure,
        stay_type,
        body.hookup_type   ?? null,
        body.site_category ?? null,
        body.membership_id ?? null,
        // program column intentionally omitted — new rows use membership_id FK instead
        body.status        ?? 'Booked',
        body.total_charged ?? 0,
        body.deposit_paid  ?? 0,
        body.notes         ?? null,
        body.phone         ?? null,
        body.email         ?? null,
        body.website      ?? null,
      ]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM stays WHERE id = ?',
      [result.insertId]
    );
    return NextResponse.json(rows[0] as Stay, { status: 201 });
  } catch (err) {
    console.error('[POST /api/stays]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
