import { getPool } from '@/lib/db';
import type { Stay, Membership } from '@/lib/types';
import type { RowDataPacket } from 'mysql2';
import type {
  BigPictureData, StayTypeData, TrendsData,
  GeographyRow, MembershipRow, MembershipData,
  LengthBucket, ReportData,
} from '@/lib/report-types';

// Re-export everything from report-types so existing imports keep working
export type {
  BigPictureData, StayTypeData, TrendsData, MonthlyByYearRow,
  GeographyRow, MembershipRow, MembershipData, LengthBucket, ReportData,
} from '@/lib/report-types';
export { STAY_TYPE_COLORS, YEAR_COLORS } from '@/lib/report-types';

/* ── Helpers ────────────────────────────────────────────────────── */
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const BUCKETS = ['1 night', '2–3 nights', '4–6 nights', '7–13 nights', '14+ nights'] as const;

function getBucket(nights: number): string {
  if (nights === 1) return '1 night';
  if (nights <= 3)  return '2–3 nights';
  if (nights <= 6)  return '4–6 nights';
  if (nights <= 13) return '7–13 nights';
  return '14+ nights';
}

/* ── Core computation (server-only) ─────────────────────────────── */
export async function computeReports(year: string): Promise<ReportData> {
  const pool = getPool();

  const [[staysRows], [membershipRows]] = await Promise.all([
    pool.query<RowDataPacket[]>('SELECT * FROM stays ORDER BY arrival ASC'),
    pool.query<RowDataPacket[]>('SELECT * FROM memberships ORDER BY name ASC'),
  ]);

  const allStays    = staysRows    as Stay[];
  const memberships = membershipRows as Membership[];

  const filteredStays = year === 'all'
    ? allStays
    : allStays.filter(s => s.arrival.startsWith(year));

  /* ── Big Picture ──────────────────────────────────────────────── */
  const totalNights = filteredStays.reduce((sum, s) => sum + (s.nights || 0), 0);
  const totalSpend  = filteredStays.reduce((sum, s) => sum + (s.total_charged || 0), 0);

  const paidStays  = filteredStays.filter(s => (s.total_charged || 0) > 0);
  const paidNights = paidStays.reduce((sum, s) => sum + (s.nights || 0), 0);
  const avgCostPaidOnly = paidNights  > 0 ? totalSpend / paidNights  : 0;
  const avgCostAllStays = totalNights > 0 ? totalSpend / totalNights : 0;

  const freeNights = filteredStays
    .filter(s => (s.total_charged || 0) === 0)
    .reduce((sum, s) => sum + (s.nights || 0), 0);
  const freeNightsPercent = totalNights > 0 ? (freeNights / totalNights) * 100 : 0;

  let mostExpensiveStay: BigPictureData['mostExpensiveStay'] = null;
  for (const s of filteredStays) {
    if (
      (s.total_charged || 0) > 0 &&
      (!mostExpensiveStay || s.total_charged > mostExpensiveStay.totalCharged)
    ) {
      mostExpensiveStay = { id: s.id, name: s.name, totalCharged: s.total_charged };
    }
  }

  const bigPicture: BigPictureData = {
    totalNights, totalSpend, avgCostPaidOnly, avgCostAllStays,
    freeNightsPercent, mostExpensiveStay,
  };

  /* ── Stay Types ───────────────────────────────────────────────── */
  const typeMap = new Map<string, { nights: number; spend: number }>();
  for (const s of filteredStays) {
    const prev = typeMap.get(s.stay_type) ?? { nights: 0, spend: 0 };
    typeMap.set(s.stay_type, {
      nights: prev.nights + (s.nights || 0),
      spend:  prev.spend  + (s.total_charged || 0),
    });
  }

  const pie = Array.from(typeMap.entries())
    .map(([type, { nights }]) => ({
      type, nights,
      percent: totalNights > 0 ? (nights / totalNights) * 100 : 0,
    }))
    .sort((a, b) => b.nights - a.nights);

  const avgCostByType = Array.from(typeMap.entries())
    .map(([type, { nights, spend }]) => ({
      type, avgCost: nights > 0 ? spend / nights : 0,
    }))
    .sort((a, b) => b.avgCost - a.avgCost);

  const stayTypes: StayTypeData = { pie, avgCostByType };

  /* ── Trends ───────────────────────────────────────────────────── */
  const allYears = [...new Set(allStays.map(s => s.arrival.slice(0, 4)))].sort();

  const yearTotalsMap = new Map<string, number>();
  for (const s of allStays) {
    const y = s.arrival.slice(0, 4);
    yearTotalsMap.set(y, (yearTotalsMap.get(y) ?? 0) + (s.total_charged || 0));
  }
  const yearTotals = allYears.map(y => ({ year: y, spend: yearTotalsMap.get(y) ?? 0 }));

  const mbyMap = new Map<number, Record<string, number>>();
  for (let m = 1; m <= 12; m++) mbyMap.set(m, {});
  for (const s of allStays) {
    const y = s.arrival.slice(0, 4);
    const m = parseInt(s.arrival.slice(5, 7), 10);
    const row = mbyMap.get(m)!;
    row[y] = (row[y] ?? 0) + (s.total_charged || 0);
  }
  const monthlyByYear = Array.from(mbyMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([m, data]) => ({ month: MONTH_LABELS[m - 1], ...data }));

  const mfyMap = new Map<number, number>();
  for (const s of filteredStays) {
    const m = parseInt(s.arrival.slice(5, 7), 10);
    mfyMap.set(m, (mfyMap.get(m) ?? 0) + (s.total_charged || 0));
  }
  const monthlyForYear = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1, label: MONTH_LABELS[i], spend: mfyMap.get(i + 1) ?? 0,
  }));

  const trends: TrendsData = { yearTotals, monthlyByYear, monthlyForYear, years: allYears };

  /* ── Geography ────────────────────────────────────────────────── */
  const geoMap = new Map<string, {
    state: string; country: string;
    totalNights: number; totalSpend: number; freeNights: number;
  }>();

  for (const s of filteredStays) {
    const state   = s.state   || '(Unknown)';
    const country = s.country || 'USA';
    const key     = `${state}||${country}`;
    const prev    = geoMap.get(key) ?? { state, country, totalNights: 0, totalSpend: 0, freeNights: 0 };
    prev.totalNights += s.nights || 0;
    prev.totalSpend  += s.total_charged || 0;
    if ((s.total_charged || 0) === 0) prev.freeNights += s.nights || 0;
    geoMap.set(key, prev);
  }

  const geography: GeographyRow[] = Array.from(geoMap.values())
    .map(row => ({
      ...row,
      avgPerNight: row.totalNights > 0 ? row.totalSpend / row.totalNights : 0,
      freePercent: row.totalNights > 0 ? (row.freeNights / row.totalNights) * 100 : 0,
    }))
    .sort((a, b) => b.totalNights - a.totalNights);

  /* ── Memberships ──────────────────────────────────────────────── */
  const distinctYearsSet = new Set(filteredStays.map(s => s.arrival.slice(0, 4)));
  const yearsCount = Math.max(distinctYearsSet.size, 1);

  const paidEligible = filteredStays.filter(s => (s.total_charged || 0) > 0 && (s.nights || 0) > 0);
  const avgPaidPerNight = paidEligible.length > 0
    ? paidEligible.reduce((sum, s) => sum + (s.total_charged || 0), 0) /
      paidEligible.reduce((sum, s) => sum + (s.nights || 0), 0)
    : 0;

  const membershipRowsComputed: MembershipRow[] = memberships.map(m => {
    const mStays             = filteredStays.filter(s => s.program === m.name);
    const nightsUsed         = mStays.reduce((sum, s) => sum + (s.nights || 0), 0);
    const mSpend             = mStays.reduce((sum, s) => sum + (s.total_charged || 0), 0);
    const effectiveAnnualFee = (m.annual_fee || 0) * yearsCount;

    const isDiscount = (m.discount_desc ?? '').includes('%');
    const estSavings = isDiscount
      ? 0.10 * mSpend - effectiveAnnualFee
      : nightsUsed * avgPaidPerNight - effectiveAnnualFee;

    const effectivePerNight = nightsUsed > 0 ? effectiveAnnualFee / nightsUsed : null;

    return {
      name: m.name,
      annualFee: m.annual_fee || 0,
      effectiveAnnualFee,
      nightsUsed,
      effectivePerNight,
      estSavings,
      worthIt: estSavings > 0,
    };
  });

  const membershipData: MembershipData = {
    rows: membershipRowsComputed,
    avgPaidPerNight,
    yearsCount,
  };

  /* ── Stay Length Buckets ──────────────────────────────────────── */
  const bucketTotals = new Map<string, { spend: number; nights: number; count: number }>();
  BUCKETS.forEach(b => bucketTotals.set(b, { spend: 0, nights: 0, count: 0 }));

  const eligibleLengthStays = filteredStays.filter(
    s => (s.stay_type === 'Paid' || s.stay_type === 'Harvest Host') &&
         (s.total_charged || 0) > 0 && (s.nights || 0) > 0
  );

  for (const s of eligibleLengthStays) {
    const bucket = getBucket(s.nights);
    const cur = bucketTotals.get(bucket)!;
    cur.spend  += s.total_charged || 0;
    cur.nights += s.nights || 0;
    cur.count  += 1;
    bucketTotals.set(bucket, cur);
  }

  const lengthBuckets: LengthBucket[] = BUCKETS.map(bucket => {
    const { spend, nights, count } = bucketTotals.get(bucket)!;
    return {
      bucket,
      avgCostPerNight: nights > 0 ? spend / nights : null,
      count,
    };
  });

  return {
    year,
    bigPicture,
    stayTypes,
    trends,
    geography,
    memberships: membershipData,
    lengthBuckets,
  };
}
