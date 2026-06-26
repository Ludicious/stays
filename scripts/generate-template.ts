import * as path from 'path';
import * as ExcelJS from 'exceljs';

const HEADERS = [
  'Campground Name', 'Arrival Date', 'Departure Date', 'City', 'State', 'Country',
  'Full Address', 'Stay Type', 'Program', 'Total Charged', 'Deposit Paid',
  'Confirmation Number', 'Phone', 'Email', 'Website', 'Notes',
];

const COL_WIDTHS: Record<string, number> = {
  'Campground Name':    30,
  'Arrival Date':       14,
  'Departure Date':     14,
  'City':               16,
  'State':               8,
  'Country':            10,
  'Full Address':       36,
  'Stay Type':          14,
  'Program':            20,
  'Total Charged':      14,
  'Deposit Paid':       14,
  'Confirmation Number': 20,
  'Phone':              16,
  'Email':              24,
  'Website':            36,
  'Notes':              42,
};

const EXAMPLES: (string | number | null)[][] = [
  [
    'Wytheville KOA', '2024-08-15', '2024-08-18', 'Wytheville', 'VA', 'USA',
    '231 KOA Rd, Wytheville VA 24382', 'Paid', 'KOA', 165.00, 50.00,
    'RES-789456', '276-228-2601', null, 'https://koa.com/campgrounds/wytheville',
    'Easy interstate access, full hookups',
  ],
  [
    'Shadow Mountain Dispersed', '2024-09-02', '2024-09-05', 'Moose', 'WY', 'USA',
    null, 'Boondocking', null, 0, 0,
    null, null, null, null,
    'Free USFS dispersed near Grand Teton, no services',
  ],
  [
    'Echo Ridge Cellars', '2024-04-25', '2024-04-26', 'Echo', 'OR', 'USA',
    'Echo, OR', 'Harvest Host', 'Harvest Host', 50.00, 0,
    null, null, null, null,
    'Bought a case of wine, parked overnight',
  ],
];

async function main() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Stays Import');

  // ── Row 1: warning (merged, red on yellow) ───────────────────────
  const warnText = 'DELETE EXAMPLE ROWS BELOW BEFORE IMPORTING';
  ws.mergeCells(`A1:P1`);
  const warnCell = ws.getCell('A1');
  warnCell.value = warnText;
  warnCell.font  = { bold: true, color: { argb: 'FFDC2626' } };
  warnCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
  warnCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 22;

  // ── Row 2: column headers ────────────────────────────────────────
  const hdrRow = ws.getRow(2);
  HEADERS.forEach((h, i) => {
    const cell = hdrRow.getCell(i + 1);
    cell.value = h;
    cell.font  = { bold: true, color: { argb: 'FF0F2238' } };
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.alignment = { vertical: 'middle' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFC8C1B7' } } };
  });
  hdrRow.height = 20;
  hdrRow.commit();

  // Freeze rows 1–2
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 2, topLeftCell: 'A3', activeCell: 'A3' }];

  // ── Rows 3–5: example data (italic, muted) ───────────────────────
  EXAMPLES.forEach((ex, ri) => {
    const row = ws.getRow(ri + 3);
    ex.forEach((val, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = val;
      cell.font  = { italic: true, color: { argb: 'FF64748B' } };
    });
    row.height = 18;
    row.commit();
  });

  // ── Column widths ────────────────────────────────────────────────
  HEADERS.forEach((h, i) => {
    ws.getColumn(i + 1).width = COL_WIDTHS[h] ?? 14;
  });

  // ── Write ────────────────────────────────────────────────────────
  const outPath = path.resolve(__dirname, '../public/templates/stays-import-template.xlsx');
  await wb.xlsx.writeFile(outPath);
  console.log(`✓ Template written to ${outPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
