import * as ExcelJS from 'exceljs';
import type { StayType } from './types';
import type { ParsedStay } from './import-types';

// ── Cell helpers ─────────────────────────────────────────────────────

function unwrap(v: unknown): unknown {
  if (!v || typeof v !== 'object') return v;
  const o = v as Record<string, unknown>;
  if ('result' in o) return o.result;
  if ('sharedFormula' in o) return o.result ?? null;
  if ('error' in o) return null;
  // RichText
  if ('richText' in o && Array.isArray(o.richText)) {
    return (o.richText as Array<{ text?: string }>).map(r => r.text ?? '').join('');
  }
  return v;
}

function str(v: unknown): string | null {
  const u = unwrap(v);
  if (u === null || u === undefined) return null;
  if (u instanceof Date) return null;
  const s = String(u).trim();
  return s === '' ? null : s;
}

function num(v: unknown): number {
  const u = unwrap(v);
  if (u instanceof Date) return 0;
  const n = Number(u);
  return isNaN(n) ? 0 : n;
}

function numOrNull(v: unknown): number | null {
  const u = unwrap(v);
  if (u === null || u === undefined || u === '') return null;
  if (u instanceof Date) return null;
  const n = Number(u);
  return isNaN(n) ? null : n;
}

// ── Date parsing ─────────────────────────────────────────────────────

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Parse MM/DD/YY or MM/DD/YYYY (RV Life format)
function parseMDY(v: unknown): string | null {
  const u = unwrap(v);
  if (!u) return null;
  if (u instanceof Date) return isNaN(u.getTime()) ? null : toYMD(u);
  const s = String(u).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const [, mo, da, yr] = m;
    const year = yr.length === 2 ? `20${yr}` : yr;
    return `${year}-${mo.padStart(2, '0')}-${da.padStart(2, '0')}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : toYMD(d);
}

// Parse YYYY-MM-DD, MM/DD/YYYY, or MM/DD/YY (template format)
function parseFlexDate(v: unknown): string | null {
  const u = unwrap(v);
  if (!u) return null;
  if (u instanceof Date) return isNaN(u.getTime()) ? null : toYMD(u);
  const s = String(u).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return parseMDY(s);
}

// ── Address-like detection ───────────────────────────────────────────

function isAddressLike(name: string): boolean {
  if ((name.match(/,/g) ?? []).length >= 2) return true;
  if (/^\d+\s+\w/.test(name)) return true;
  if (/\b\d{5}(-\d{4})?\b/.test(name)) return true;         // US 5-digit (with optional +4)
  if (/\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/.test(name)) return true; // Canadian A1A 1A1
  return false;
}

// ── Stay type heuristics ─────────────────────────────────────────────

const TT_KW   = ['thousand trails'];
const HH_KW   = ['winery', 'cellars', 'vineyard', 'vineyards', 'brewery', 'distilling', 'distillery', 'farm'];
const BDK_KW  = ['blm', 'usfs', 'forest service', 'national forest', 'dispersed', 'boondock', 'boondocking'];
const VALID_TYPES = new Set<string>(['Paid', 'Boondocking', 'Harvest Host', 'Free']);

function applySuggestions(
  name: string,
  total_charged: number,
  rawStayType: string | null,
  rawProgram:   string | null,
): { suggested_stay_type: StayType; suggested_program: string | null } {
  const lower   = name.toLowerCase();
  let program   = rawProgram && rawProgram.trim() !== '' ? rawProgram : null;

  // If template provided a valid stay type, respect it
  if (rawStayType && VALID_TYPES.has(rawStayType)) {
    const stay_type = rawStayType as StayType;
    // Still auto-populate program if blank and name matches
    if (!program) {
      if (TT_KW.some(k => lower.includes(k)))  program = 'Thousand Trails';
      else if (HH_KW.some(k => lower.includes(k))) program = 'Harvest Host';
    }
    return { suggested_stay_type: stay_type, suggested_program: program };
  }

  // Run heuristics
  if (TT_KW.some(k => lower.includes(k))) {
    return { suggested_stay_type: 'Free',         suggested_program: program ?? 'Thousand Trails' };
  }
  if (HH_KW.some(k => lower.includes(k))) {
    return { suggested_stay_type: 'Harvest Host', suggested_program: program ?? 'Harvest Host' };
  }
  if (BDK_KW.some(k => lower.includes(k))) {
    return { suggested_stay_type: 'Boondocking',  suggested_program: program };
  }
  if (total_charged === 0) {
    return { suggested_stay_type: 'Free',         suggested_program: program };
  }
  return { suggested_stay_type: 'Paid', suggested_program: program };
}

// ── RV Life Tripwizard parser ────────────────────────────────────────

export async function parseRVLife(buffer: Buffer): Promise<ParsedStay[]> {
  const wb = new ExcelJS.Workbook();
  // ExcelJS types predate @types/node Buffer<T> generic — cast is safe
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(buffer as any);

  const sheet = wb.getWorksheet('Trip Summary');
  if (!sheet) throw new Error('Sheet "Trip Summary" not found in this file.');

  // Find header row by scanning for "Stop Name"
  let headerRowNum = -1;
  const colIndex: Record<string, number> = {};

  sheet.eachRow((row, rowNum) => {
    if (headerRowNum !== -1) return;
    row.eachCell((cell) => {
      if (str(cell.value) === 'Stop Name') headerRowNum = rowNum;
    });
    if (headerRowNum === rowNum) {
      row.eachCell((cell, colNum) => {
        const name = str(cell.value);
        if (name) colIndex[name] = colNum;
      });
    }
  });

  if (headerRowNum === -1) throw new Error('"Stop Name" column header not found — is this a Trip Summary sheet?');

  const makeGetter = (row: ExcelJS.Row) => (colName: string) =>
    colIndex[colName] ? row.getCell(colIndex[colName])?.value : undefined;

  const stays: ParsedStay[] = [];
  let tempId = 0;

  sheet.eachRow((row, rowNum) => {
    if (rowNum <= headerRowNum) return;

    const get = makeGetter(row);
    const nights = num(get('Nights'));
    if (nights === 0) return; // trip start/waypoint rows

    const name = str(get('Stop Name'));
    if (!name) return;

    const arrival   = parseMDY(get('Arrival Date'));
    const departure = parseMDY(get('Departure Date'));
    if (!arrival || !departure) return;

    const total_charged = num(get('Camping Cost'));
    const { suggested_stay_type, suggested_program } = applySuggestions(name, total_charged, null, null);

    stays.push({
      tempId:               tempId++,
      name,
      arrival,
      departure,
      full_address:         str(get('Location')),
      website:              str(get('Url')),
      phone:                str(get('Phone')),
      email:                str(get('Email')),
      lat:                  numOrNull(get('Latitude')),
      lng:                  numOrNull(get('Longitude')),
      total_charged,
      deposit_paid:         0,
      confirmation_number:  str(get('Reservation Number')),
      notes:                str(get('Comments')),
      city:                 null,
      state:                null,
      country:              null,
      suggested_stay_type,
      suggested_program,
      name_is_address_like: isAddressLike(name),
      is_duplicate:         false,
      duplicate_of_id:      null,
      duplicate_of_arrival: null,
    });
  });

  return stays;
}

// ── Stays template parser ────────────────────────────────────────────

export async function parseStaysTemplate(buffer: Buffer): Promise<ParsedStay[]> {
  const wb = new ExcelJS.Workbook();
  // ExcelJS types predate @types/node Buffer<T> generic — cast is safe
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(buffer as any);

  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error('No worksheet found in this file.');

  // Find header row by scanning for "Campground Name" (case-insensitive)
  let headerRowNum = -1;
  const colIndex: Record<string, number> = {}; // lowercase key → column number

  sheet.eachRow((row, rowNum) => {
    if (headerRowNum !== -1) return;
    row.eachCell((cell) => {
      if (String(cell.value ?? '').trim().toLowerCase() === 'campground name') {
        headerRowNum = rowNum;
      }
    });
    if (headerRowNum === rowNum) {
      row.eachCell((cell, colNum) => {
        const name = String(cell.value ?? '').trim().toLowerCase();
        if (name) colIndex[name] = colNum;
      });
    }
  });

  if (headerRowNum === -1) throw new Error('"Campground Name" column header not found — is this a Stays template?');

  const makeGetter = (row: ExcelJS.Row) => (colName: string) =>
    colIndex[colName] ? row.getCell(colIndex[colName])?.value : undefined;

  const stays: ParsedStay[] = [];
  let tempId = 0;

  sheet.eachRow((row, rowNum) => {
    if (rowNum <= headerRowNum) return;

    const get = makeGetter(row);
    const name = str(get('campground name'));
    if (!name) return; // blank row

    const arrival   = parseFlexDate(get('arrival date'));
    const departure = parseFlexDate(get('departure date'));
    if (!arrival || !departure) return;

    const rawStayType = str(get('stay type'));
    const rawProgram  = str(get('program'));
    const total_charged = num(get('total charged'));
    const { suggested_stay_type, suggested_program } = applySuggestions(
      name, total_charged, rawStayType, rawProgram,
    );

    stays.push({
      tempId:               tempId++,
      name,
      arrival,
      departure,
      full_address:         str(get('full address')),
      website:              str(get('website')),
      phone:                str(get('phone')),
      email:                str(get('email')),
      lat:                  null,
      lng:                  null,
      total_charged,
      deposit_paid:         num(get('deposit paid')),
      confirmation_number:  str(get('confirmation number')),
      notes:                str(get('notes')),
      city:                 str(get('city')),
      state:                str(get('state')),
      country:              str(get('country')) ?? 'USA',
      suggested_stay_type,
      suggested_program,
      name_is_address_like: isAddressLike(name),
      is_duplicate:         false,
      duplicate_of_id:      null,
      duplicate_of_arrival: null,
    });
  });

  return stays;
}

// ── Entry point ──────────────────────────────────────────────────────

export async function parseImport(
  buffer: Buffer,
  format: 'rvlife' | 'template',
): Promise<ParsedStay[]> {
  return format === 'rvlife' ? parseRVLife(buffer) : parseStaysTemplate(buffer);
}
