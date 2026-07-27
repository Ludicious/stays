import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { getPool } from '@/lib/db';
import type { FuelPurchase, FuelType } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

const VALID_FUEL_TYPES: FuelType[] = ['Diesel', 'Gasoline', 'DEF', 'Propane'];

const ALLOWED = [
  'purchase_date', 'fuel_type', 'total_cost', 'discount_amount', 'settled',
  'gallons', 'odometer', 'full_fill', 'state_code', 'notes',
];

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body   = await request.json() as Partial<FuelPurchase> & Record<string, unknown>;

    if (body.fuel_type != null && !VALID_FUEL_TYPES.includes(body.fuel_type as FuelType)) {
      return NextResponse.json({ error: 'Invalid fuel_type' }, { status: 400 });
    }
    if (body.total_cost != null && (body.total_cost as number) <= 0) {
      return NextResponse.json({ error: 'total_cost must be positive' }, { status: 400 });
    }
    if (body.discount_amount != null && (body.discount_amount as number) < 0) {
      return NextResponse.json({ error: 'discount_amount must be >= 0' }, { status: 400 });
    }
    if (body.state_code != null) {
      const pool = getPool();
      const [stateRows] = await pool.query<RowDataPacket[]>(
        'SELECT code FROM states WHERE code = ?',
        [body.state_code]
      );
      if (!(stateRows as RowDataPacket[]).length) {
        return NextResponse.json({ error: 'Invalid state_code' }, { status: 400 });
      }
    }

    const fields = Object.keys(body).filter(k => ALLOWED.includes(k));
    if (!fields.length) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const pool       = getPool();
    const setClauses = fields.map(f => `${f} = ?`).join(', ');
    const values     = fields.map(f => {
      const v = body[f];
      // Coerce booleans to 0/1 for TINYINT columns
      if (f === 'settled' || f === 'full_fill') return v ? 1 : 0;
      return v;
    });

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE fuel_purchases SET ${setClauses} WHERE id = ?`,
      [...values, id]
    );
    if (!result.affectedRows) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM fuel_purchases WHERE id = ?',
      [id]
    );
    return NextResponse.json(rows[0] as FuelPurchase);
  } catch (err) {
    console.error('[PATCH /api/fuel/:id]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const pool   = getPool();
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM fuel_purchases WHERE id = ?',
      [id]
    );
    if (!result.affectedRows) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('[DELETE /api/fuel/:id]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
