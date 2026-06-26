import { NextRequest, NextResponse } from 'next/server';
import { parseImport } from '@/lib/import-parser';
import { getPool } from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import type { ParsedStay, ParseResponse } from '@/lib/import-types';

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file     = formData.get('file') as File | null;
    const format   = formData.get('format') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }
    if (!format || !['rvlife', 'template'].includes(format)) {
      return NextResponse.json({ error: 'Invalid format.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large (max 5 MB).' }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json({ error: 'Only .xlsx files are supported.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // xlsx files are ZIP archives — magic bytes PK\x03\x04 (0x50 0x4B 0x03 0x04).
    // Reject anything that doesn't match before ExcelJS can throw an unhandled stream error.
    if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4B) {
      return NextResponse.json({ error: 'File does not appear to be a valid .xlsx file.' }, { status: 400 });
    }

    const parsed = await parseImport(buffer, format as 'rvlife' | 'template');

    // Load existing stays for duplicate detection
    const pool = getPool();
    const [existingRows] = await pool.query<RowDataPacket[]>(
      'SELECT id, name, arrival FROM stays',
    );
    const existing = existingRows as { id: number; name: string; arrival: string }[];

    // Dedup: same name (case-insensitive) + exact same arrival date.
    // A 3-day window caused false positives for repeat visits to the same campground
    // on different trips — same day is the only reliable signal of a true re-import.
    const stays: ParsedStay[] = parsed.map(stay => {
      const lowerName = stay.name.toLowerCase().trim();

      for (const ex of existing) {
        if (ex.name.toLowerCase().trim() !== lowerName) continue;
        // Compare as date strings (both are YYYY-MM-DD) — no Date object needed
        const exDate = typeof ex.arrival === 'string'
          ? ex.arrival.slice(0, 10)
          : new Date(ex.arrival as unknown as Date).toISOString().slice(0, 10);
        if (exDate === stay.arrival) {
          return {
            ...stay,
            is_duplicate:         true,
            duplicate_of_id:      ex.id,
            duplicate_of_arrival: ex.arrival,
          };
        }
      }
      return stay;
    });

    const summary = {
      total:            stays.length,
      duplicatesFound:  stays.filter(s => s.is_duplicate).length,
      addressLikeNames: stays.filter(s => s.name_is_address_like).length,
    };

    const response: ParseResponse = { stays, summary };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Parse failed.';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
