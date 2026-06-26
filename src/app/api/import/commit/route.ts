import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import type { CommitStay, CommitResponse } from '@/lib/import-types';
import type { ResultSetHeader } from 'mysql2';

const INSERT_SQL = `
  INSERT INTO stays
    (name, city, state, country, full_address, lat, lng,
     arrival, departure, stay_type, program, status,
     total_charged, deposit_paid, confirmation_number,
     phone, email, website, notes)
  VALUES
    (?, ?, ?, ?, ?, ?, ?,
     ?, ?, ?, ?, ?,
     ?, ?, ?,
     ?, ?, ?, ?)
`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { stays: CommitStay[] };
    if (!Array.isArray(body?.stays)) {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
    }

    const toInsert = body.stays.filter(s => !s.skip);
    const today    = new Date().toISOString().slice(0, 10);
    const pool     = getPool();

    let imported = 0;
    let hasUpcoming = false;
    const errors: CommitResponse['errors'] = [];
    const importedIds: number[] = [];

    for (const stay of toInsert) {
      try {
        const status = stay.departure < today ? 'Stayed' : 'Booked';
        if (status === 'Booked') hasUpcoming = true;

        const [result] = await pool.query<ResultSetHeader>(INSERT_SQL, [
          stay.name,
          stay.city   ?? null,
          stay.state  ?? null,
          stay.country ?? 'USA',
          stay.full_address ?? null,
          stay.lat ?? null,
          stay.lng ?? null,
          stay.arrival,
          stay.departure,
          stay.stay_type,
          stay.program || null,
          status,
          stay.total_charged,
          stay.deposit_paid,
          stay.confirmation_number ?? null,
          stay.phone   ?? null,
          stay.email   ?? null,
          stay.website ?? null,
          stay.notes   ?? null,
        ]);
        importedIds.push(result.insertId);
        imported++;
      } catch (err) {
        errors.push({
          tempId: stay.tempId,
          name:   stay.name,
          error:  err instanceof Error ? err.message : 'Insert failed',
        });
      }
    }

    const response: CommitResponse = { imported, errors, hasUpcoming };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Commit failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
