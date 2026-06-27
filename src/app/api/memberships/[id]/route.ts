import { NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import { getPool } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

const ALLOWED = [
  'name', 'annual_fee', 'savings_method', 'discount_percent', 'per_stay_value',
  'discount_desc', 'affiliate_url', 'active', 'notes',
];

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const pool   = getPool();
  try {
    const body   = await request.json() as Record<string, unknown>;
    const fields = Object.keys(body).filter(k => ALLOWED.includes(k));
    if (!fields.length) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
    }
    const sets = fields.map(f => `${f} = ?`).join(', ');
    const vals = fields.map(f => body[f]);
    await pool.query(`UPDATE memberships SET ${sets} WHERE id = ?`, [...vals, id]);
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM memberships WHERE id = ?', [id]
    );
    if (!(rows as RowDataPacket[]).length) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }
    return NextResponse.json((rows as RowDataPacket[])[0]);
  } catch (err) {
    console.error('[memberships PATCH]', err);
    return NextResponse.json({ error: 'Failed to update membership.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const pool   = getPool();
  try {
    await pool.query('DELETE FROM memberships WHERE id = ?', [id]);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('[memberships DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete membership.' }, { status: 500 });
  }
}
