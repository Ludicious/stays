import * as path from 'path';
import * as ExcelJS from 'exceljs';
import * as mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const XLSX_PATH = path.resolve(__dirname, '../Nomad_Stay_Tracker.xlsx');
const HEADER_ROW = 5; // 1-indexed; row 6 is first data row
const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function num(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function toDate(v: unknown): string | null {
  if (!v) return null;
  // ExcelJS returns formula cells as { formula, result, date1904 } objects
  const resolved = (v && typeof v === 'object' && 'result' in v)
    ? (v as { result: unknown }).result
    : v;
  if (!resolved) return null;
  const d = resolved instanceof Date ? resolved : new Date(String(resolved));
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function resolveStatus(
  paid: string | null,
  departureStr: string | null,
  totalCharged: number,
  depositPaid: number
): string {
  const depDate = departureStr ? new Date(departureStr) : null;
  const isPast = depDate ? depDate < TODAY : false;

  if (paid === 'Deposit') return 'Deposit Paid';
  if (paid === 'No' || paid === null) return 'Booked';

  // paid === 'Yes'
  if (isPast) return 'Stayed';
  // future 'Yes'
  if (totalCharged === 0) return 'Booked';            // free stay, nothing to pay
  if (depositPaid > 0 && depositPaid < totalCharged)  return 'Deposit Paid';
  if (depositPaid >= totalCharged)                    return 'Paid in Full';
  return 'Booked';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);

  const sheet = wb.getWorksheet('Stays');
  if (!sheet) throw new Error('Sheet "Stays" not found');

  // Read header row to build column-name → column-index map
  const headerRow = sheet.getRow(HEADER_ROW);
  const colIndex: Record<string, number> = {};
  headerRow.eachCell((cell, colNum) => {
    const name = str(cell.value);
    if (name) colIndex[name] = colNum;
  });

  const required = [
    'Resort / Campground', 'City', 'State', 'Country',
    'Arrival', 'Departure', 'Program / Affiliate', 'Stay Type',
    'Total Charged', 'Deposit Paid', 'Paid?', 'Notes',
    'Phone', 'Email', 'Website', 'Full Address',
  ];
  for (const col of required) {
    if (!colIndex[col]) throw new Error(`Column "${col}" not found in header row ${HEADER_ROW}`);
  }

  const rows: Record<string, unknown>[] = [];
  const warnings: string[] = [];

  sheet.eachRow((row, rowNum) => {
    if (rowNum <= HEADER_ROW) return; // skip header block

    // Unwrap ExcelJS cell values:
    //   { formula, result }    → result  (formula cells with cached value)
    //   { sharedFormula, ... } → result if present, else null (shared formula ref)
    //   { error: '#...' }      → null   (error cells)
    const get = (name: string) => {
      const v = row.getCell(colIndex[name])?.value;
      if (!v || typeof v !== 'object') return v;
      if ('result' in v) return (v as { result: unknown }).result;
      if ('sharedFormula' in v) {
        const sv = v as { sharedFormula: string; result?: unknown };
        return sv.result !== undefined ? sv.result : null;
      }
      if ('error' in v) return null;
      return v;
    };

    // Skip blank/trailing rows
    if (!str(get('Resort / Campground')) && !get('Arrival')) return;

    const rawStayType = str(get('Stay Type'));
    let stayType = rawStayType;
    if (!stayType) {
      const name = str(get('Resort / Campground')) ?? `row ${rowNum}`;
      warnings.push(
        `[WARN] Row ${rowNum}: "${name}" has no Stay Type — defaulting to 'Paid'`
      );
      stayType = 'Paid';
    }

    const totalCharged = num(get('Total Charged'));
    const depositPaid  = num(get('Deposit Paid'));
    const departureStr = toDate(get('Departure'));
    const paid         = str(get('Paid?'));
    const status       = resolveStatus(paid, departureStr, totalCharged, depositPaid);

    rows.push({
      name:          str(get('Resort / Campground')),
      city:          str(get('City')),
      state:         str(get('State')),
      country:       str(get('Country')) ?? 'USA',
      full_address:  str(get('Full Address')),
      arrival:       toDate(get('Arrival')),
      departure:     departureStr,
      stay_type:     stayType,
      program:       str(get('Program / Affiliate')),
      status,
      total_charged: totalCharged,
      deposit_paid:  depositPaid,
      notes:         str(get('Notes')),
      phone:         str(get('Phone')),
      email:         str(get('Email')),
      website:       str(get('Website')),
    });
  });

  // Print warnings before touching the DB
  if (warnings.length) {
    console.log('\nWarnings:');
    warnings.forEach(w => console.log(w));
    console.log();
  }

  console.log(`Read ${rows.length} rows from spreadsheet.`);

  const conn = await mysql.createConnection({
    host:     process.env.MYSQL_HOST,
    user:     process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port:     Number(process.env.MYSQL_PORT ?? 3306),
    ssl:      process.env.MYSQL_HOST !== 'localhost' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    // Truncate first so the script is safely re-runnable
    await conn.query('TRUNCATE TABLE stays');
    console.log('stays table cleared.\n');

    const sql = `
      INSERT INTO stays
        (name, city, state, country, full_address, arrival, departure,
         stay_type, program, status, total_charged, deposit_paid,
         notes, phone, email, website)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    let inserted = 0;
    for (const r of rows) {
      await conn.query(sql, [
        r.name, r.city, r.state, r.country, r.full_address,
        r.arrival, r.departure, r.stay_type, r.program, r.status,
        r.total_charged, r.deposit_paid,
        r.notes, r.phone, r.email, r.website,
      ]);
      inserted++;
    }

    console.log(`Inserted ${inserted} rows into stays.\n`);

    // Verification queries
    const [countRows] = await conn.query<mysql.RowDataPacket[]>(
      'SELECT COUNT(*) AS total FROM stays'
    );
    console.log(`Total stays: ${countRows[0].total} (expected 132)`);

    const [byStatus] = await conn.query<mysql.RowDataPacket[]>(
      'SELECT status, COUNT(*) AS n FROM stays GROUP BY status ORDER BY status'
    );
    console.log('\nBy status:');
    byStatus.forEach(r => console.log(`  ${r.status}: ${r.n}`));

    const [byType] = await conn.query<mysql.RowDataPacket[]>(
      'SELECT stay_type, COUNT(*) AS n FROM stays GROUP BY stay_type ORDER BY stay_type'
    );
    console.log('\nBy stay_type:');
    byType.forEach(r => console.log(`  ${r.stay_type}: ${r.n}`));

    const [upcoming] = await conn.query<mysql.RowDataPacket[]>(
      'SELECT name, city, state, arrival, departure, status FROM stays WHERE departure >= CURDATE() ORDER BY arrival LIMIT 5'
    );
    console.log('\nNext 5 upcoming stays:');
    upcoming.forEach(r =>
      console.log(`  ${r.arrival.toISOString().slice(0,10)} → ${r.departure.toISOString().slice(0,10)}  ${r.name}, ${r.city} ${r.state}  [${r.status}]`)
    );
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
