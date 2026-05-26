import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { getPool } from '@/lib/db';
import type { Stay } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const pool = getPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM stays WHERE id = ?', [id]
    );
    if (!rows.length) {
      return NextResponse.json({ error: 'Stay not found' }, { status: 404 });
    }
    return NextResponse.json(rows[0] as Stay);
  } catch (err) {
    console.error('[GET /api/stays/:id]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json() as Partial<Stay>;

    const allowed = [
      'name', 'city', 'state', 'country', 'full_address', 'lat', 'lng', 'place_id',
      'arrival', 'departure', 'stay_type', 'program', 'status',
      'total_charged', 'deposit_paid', 'confirmation_number',
      'gate_code', 'check_in_time', 'check_in_instructions',
      'phone', 'email', 'website', 'notes',
    ];

    const fields = Object.keys(body).filter(k => allowed.includes(k));
    if (!fields.length) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const pool = getPool();
    const setClauses = fields.map(f => `${f} = ?`).join(', ');
    const values     = fields.map(f => (body as Record<string, unknown>)[f]);

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE stays SET ${setClauses} WHERE id = ?`,
      [...values, id]
    );
    if (!result.affectedRows) {
      return NextResponse.json({ error: 'Stay not found' }, { status: 404 });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM stays WHERE id = ?', [id]
    );
    return NextResponse.json(rows[0] as Stay);
  } catch (err) {
    console.error('[PATCH /api/stays/:id]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const pool = getPool();
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM stays WHERE id = ?', [id]
    );
    if (!result.affectedRows) {
      return NextResponse.json({ error: 'Stay not found' }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('[DELETE /api/stays/:id]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
