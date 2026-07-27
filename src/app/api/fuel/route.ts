import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { getPool } from '@/lib/db';
import type { FuelPurchase, FuelType } from '@/lib/types';

const VALID_FUEL_TYPES: FuelType[] = ['Diesel', 'Gasoline', 'DEF', 'Propane'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type    = searchParams.get('type');
    const year    = searchParams.get('year');
    const settled = searchParams.get('settled');

    const pool = getPool();
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (type && VALID_FUEL_TYPES.includes(type as FuelType)) {
      clauses.push('fuel_type = ?');
      params.push(type);
    }
    if (year && /^\d{4}$/.test(year)) {
      clauses.push('YEAR(purchase_date) = ?');
      params.push(year);
    }
    if (settled === '0' || settled === '1') {
      clauses.push('settled = ?');
      params.push(Number(settled));
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM fuel_purchases ${where} ORDER BY purchase_date DESC, id DESC`,
      params
    );
    return NextResponse.json(rows as FuelPurchase[]);
  } catch (err) {
    console.error('[GET /api/fuel]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      purchase_date?:   string;
      fuel_type?:       string;
      total_cost?:      number;
      discount_amount?: number | null;
      settled?:         boolean;
      gallons?:         number | null;
      odometer?:        number | null;
      full_fill?:       boolean;
      state_code?:      string | null;
      notes?:           string | null;
    };

    const { purchase_date, fuel_type, total_cost } = body;

    if (!purchase_date) {
      return NextResponse.json({ error: 'purchase_date is required' }, { status: 400 });
    }
    if (!fuel_type || !VALID_FUEL_TYPES.includes(fuel_type as FuelType)) {
      return NextResponse.json(
        { error: `fuel_type must be one of: ${VALID_FUEL_TYPES.join(', ')}` },
        { status: 400 }
      );
    }
    if (!total_cost || total_cost <= 0) {
      return NextResponse.json({ error: 'total_cost must be a positive number' }, { status: 400 });
    }
    if (body.discount_amount != null && body.discount_amount < 0) {
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

    const pool = getPool();
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO fuel_purchases
         (purchase_date, fuel_type, total_cost, discount_amount, settled,
          gallons, odometer, full_fill, state_code, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        purchase_date,
        fuel_type,
        total_cost,
        body.discount_amount ?? null,
        body.settled !== false ? 1 : 0,
        body.gallons  ?? null,
        body.odometer ?? null,
        body.full_fill !== false ? 1 : 0,
        body.state_code ?? null,
        body.notes ?? null,
      ]
    );

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM fuel_purchases WHERE id = ?',
      [result.insertId]
    );
    return NextResponse.json(rows[0] as FuelPurchase, { status: 201 });
  } catch (err) {
    console.error('[POST /api/fuel]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
