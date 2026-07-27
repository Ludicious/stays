import { getPool } from '@/lib/db';
import type { Stay, Membership, MembershipPeriod } from '@/lib/types';
import type { RowDataPacket } from 'mysql2';
import { SOLAR_SYSTEM } from '@/lib/solar';
import type {
  BigPictureData, StayTypeData, TrendsData,
  GeographyRow, MembershipRow, MembershipData,
  LengthBucket, SolarBuckets, SolarData, ReportData,
} from '@/lib/report-types';

// Re-export everything from report-types so existing imports keep working
export type {
  BigPictureData, StayTypeData, TrendsData, MonthlyByYearRow,
  GeographyRow, MembershipRow, MembershipData, LengthBucket,
  SolarBuckets, SolarData, ReportData,
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

function parseYmdDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Count distinct calendar months touched by [start, end] inclusive.
// Partial months at either boundary count as a full month (per spec).
function countCalendarMonths(start: Date, end: Date): number {
  if (end < start) return 0;
  return (end.getFullYear() - start.getFullYear()) * 12 +
         (end.getMonth()    - start.getMonth())    + 1;
}

// Sum period fees prorated to [windowStart, windowEnd].
function proratedFeeForPeriods(
  periods:     MembershipPeriod[],
  windowStart: Date,
  windowEnd:   Date,
): { fee: number; months: number } {
  const today = new Date();
  let totalFee    = 0;
  let totalMonths = 0;
  for (const p of periods) {
    const pStart = parseYmdDate(p.start_date);
    const pEnd   = p.end_date ? parseYmdDate(p.end_date) : today;
    const oStart = pStart > windowStart ? pStart : windowStart;
    const oEnd   = pEnd   < windowEnd   ? pEnd   : windowEnd;
    if (oStart > oEnd) continue;
    const months  = countCalendarMonths(oStart, oEnd);
    totalFee     += (months / 12) * p.annual_fee;
    totalMonths  += months;
  }
  return { fee: totalFee, months: totalMonths };
}

/* ── Core computation (server-only) ─────────────────────────────── */
export async function computeReports(year: string): Promise<ReportData> {
  const pool = getPool();

  const [[staysRows], [membershipRows]] = await Promise.all([
    pool.query<RowDataPacket[]>('SELECT * FROM stays ORDER BY arrival ASC'),
    pool.query<RowDataPacket[]>('SELECT * FROM memberships ORDER BY name ASC'),
  ]);

  // membership_periods may not exist before migration 13 is run; degrade gracefully
  let periodRows: MembershipPeriod[] = [];
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM membership_periods ORDER BY membership_id, start_date ASC'
    );
    periodRows = rows as MembershipPeriod[];
  } catch {
    // Table not yet created; falls back to legacy yearsCount calculation
  }

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

  // Most expensive stay (total charge)
  let mostExpensiveStay: BigPictureData['mostExpensiveStay'] = null;
  for (const s of filteredStays) {
    if (
      (s.total_charged || 0) > 0 &&
      (!mostExpensiveStay || s.total_charged > mostExpensiveStay.totalCharged)
    ) {
      mostExpensiveStay = { id: s.id, name: s.name, totalCharged: s.total_charged };
    }
  }

  // Most expensive + cheapest per-night (paid stays with nights > 0 only)
  const eligiblePaid = filteredStays.filter(s => (s.total_charged || 0) > 0 && (s.nights || 0) > 0);
  let mostExpensivePerNight: BigPictureData['mostExpensivePerNight'] = null;
  let cheapestPaidPerNight:  BigPictureData['cheapestPaidPerNight']  = null;
  for (const s of eligiblePaid) {
    const rate = s.total_charged / s.nights;
    if (!mostExpensivePerNight || rate > mostExpensivePerNight.perNight) {
      mostExpensivePerNight = { id: s.id, name: s.name, perNight: rate };
    }
    if (!cheapestPaidPerNight || rate < cheapestPaidPerNight.perNight) {
      cheapestPaidPerNight = { id: s.id, name: s.name, perNight: rate };
    }
  }

  // Outstanding balance — live from today, NOT filtered by year
  const today = new Date().toISOString().slice(0, 10);
  const outstandingBalance = allStays
    .filter(s =>
      (s.status === 'Booked' || s.status === 'Deposit Paid') &&
      s.departure >= today
    )
    .reduce((sum, s) => sum + (s.balance_due || 0), 0);

  const paidNightsAll       = filteredStays.filter(s => s.stay_type === 'Paid').reduce((sum, s) => sum + (s.nights || 0), 0);
  const membershipNightsAll = filteredStays.filter(s => s.stay_type === 'Membership').reduce((sum, s) => sum + (s.nights || 0), 0);
  const freeNightsAll       = totalNights - paidNightsAll - membershipNightsAll;
  const pctOf = (n: number) => totalNights > 0 ? (n / totalNights) * 100 : 0;

  const bigPicture: BigPictureData = {
    totalNights, totalSpend, avgCostPaidOnly, avgCostAllStays,
    freeNightsPercent, mostExpensiveStay,
    mostExpensivePerNight, cheapestPaidPerNight, outstandingBalance,
    paidPercent:       pctOf(paidNightsAll),
    membershipPercent: pctOf(membershipNightsAll),
    freePercent:       pctOf(freeNightsAll),
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

  // pct is named to avoid collision with recharts' computed 'percent' (0–1) on label props
  const pie = Array.from(typeMap.entries())
    .map(([type, { nights }]) => ({
      type, nights,
      pct: totalNights > 0 ? (nights / totalNights) * 100 : 0,
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
  // yearsCount kept for backward compat (deprecated — see MembershipData)
  const distinctYearsSet = new Set(filteredStays.map(s => s.arrival.slice(0, 4)));
  const yearsCount = Math.max(distinctYearsSet.size, 1);

  const paidEligible = filteredStays.filter(s => (s.total_charged || 0) > 0 && (s.nights || 0) > 0);
  const avgPaidPerNight = paidEligible.length > 0
    ? paidEligible.reduce((sum, s) => sum + (s.total_charged || 0), 0) /
      paidEligible.reduce((sum, s) => sum + (s.nights || 0), 0)
    : 0;

  // All-time avg paid rate for lifetime capital computation (ignores year filter)
  const allPaidEligible = allStays.filter(s => (s.total_charged || 0) > 0 && (s.nights || 0) > 0);
  const allAvgPaidPerNight = allPaidEligible.length > 0
    ? allPaidEligible.reduce((sum, s) => sum + (s.total_charged || 0), 0) /
      allPaidEligible.reduce((sum, s) => sum + (s.nights || 0), 0)
    : 0;

  // Group period rows by membership_id for O(1) lookup
  const periodsByMembership = new Map<number, MembershipPeriod[]>();
  for (const p of periodRows) {
    const arr = periodsByMembership.get(p.membership_id) ?? [];
    arr.push(p);
    periodsByMembership.set(p.membership_id, arr);
  }

  // Filter window for prorated fee computation
  const todayDate   = new Date();
  const filterStart = year === 'all' ? new Date(0)                     : new Date(parseInt(year), 0,  1);
  const filterEnd   = year === 'all' ? todayDate                       : new Date(parseInt(year), 11, 31);

  const membershipRowsComputed: MembershipRow[] = memberships.map(m => {
    const mStays   = filteredStays.filter(s => s.membership_id === m.id);
    const nightsUsed = mStays.reduce((sum, s) => sum + (s.nights || 0), 0);
    const mSpend     = mStays.reduce((sum, s) => sum + (s.total_charged || 0), 0);
    const stayCount  = mStays.length;

    // effectiveAnnualFee kept for backward compat; proratedFee is the new cost basis
    const effectiveAnnualFee   = (m.annual_fee || 0) * yearsCount;
    const periodsForMembership = periodsByMembership.get(m.id) ?? [];
    const { fee: proratedFee, months: monthsCovered } = periodsForMembership.length > 0
      ? proratedFeeForPeriods(periodsForMembership, filterStart, filterEnd)
      : { fee: effectiveAnnualFee, months: 0 }; // fallback: no periods seeded yet

    let estSavings: number;
    if (m.savings_method === 'percent_off' && m.discount_percent != null) {
      const pct = m.discount_percent / 100;
      estSavings = (mSpend / (1 - pct)) * pct - proratedFee;
    } else if (m.savings_method === 'free_vs_avg') {
      estSavings = nightsUsed * avgPaidPerNight - proratedFee;
    } else if (m.savings_method === 'per_stay_value' && m.per_stay_value != null) {
      estSavings = stayCount * m.per_stay_value - proratedFee;
    } else {
      estSavings = -proratedFee;
    }

    const effectivePerNight = nightsUsed > 0 ? proratedFee / nightsUsed : null;

    // ── Capital computation (lifetime, allStays, ignores year filter) ──
    // Only computed when acquisition_cost is set AND periods exist (both require migration 13)
    const acquisitionCost = m.acquisition_cost ?? null;
    let cumulativeNetSavings:  number | null = null;
    let acquisitionRemaining:  number | null = null;
    let projectedPaybackDate:  string | null = null;

    if (acquisitionCost != null && m.acquisition_date && periodsForMembership.length > 0) {
      // Filter to stays on or after acquisition_date — pre-acquisition nights don't count
      // toward payback of a purchase that hadn't happened yet.
      const acqDateStr    = m.acquisition_date;
      const allMStays     = allStays.filter(
        s => s.membership_id === m.id && s.arrival >= acqDateStr
      );
      const allNightsUsed = allMStays.reduce((sum, s) => sum + (s.nights || 0), 0);
      const allMSpend     = allMStays.reduce((sum, s) => sum + (s.total_charged || 0), 0);
      const allStayCount  = allMStays.length;

      let lifetimeGross: number;
      if (m.savings_method === 'percent_off' && m.discount_percent != null) {
        const pct = m.discount_percent / 100;
        lifetimeGross = (allMSpend / (1 - pct)) * pct;
      } else if (m.savings_method === 'free_vs_avg') {
        lifetimeGross = allNightsUsed * allAvgPaidPerNight;
      } else if (m.savings_method === 'per_stay_value' && m.per_stay_value != null) {
        lifetimeGross = allStayCount * m.per_stay_value;
      } else {
        lifetimeGross = 0;
      }

      const acqDate = parseYmdDate(m.acquisition_date);
      const { fee: lifetimeDues } = proratedFeeForPeriods(periodsForMembership, acqDate, todayDate);

      cumulativeNetSavings = lifetimeGross - lifetimeDues;
      acquisitionRemaining = Math.max(0, acquisitionCost - cumulativeNetSavings);

      if (acquisitionRemaining > 0 && cumulativeNetSavings > 0) {
        const monthsSinceAcq = countCalendarMonths(acqDate, todayDate);
        if (monthsSinceAcq > 0) {
          const netMonthlyRate = cumulativeNetSavings / monthsSinceAcq;
          if (netMonthlyRate > 0) {
            const monthsToGo  = Math.ceil(acquisitionRemaining / netMonthlyRate);
            const paybackDate  = new Date(todayDate);
            paybackDate.setMonth(paybackDate.getMonth() + monthsToGo);
            projectedPaybackDate = paybackDate.toISOString().slice(0, 7); // YYYY-MM
          }
        }
      }
    }

    return {
      name: m.name,
      annualFee: m.annual_fee || 0,
      effectiveAnnualFee,
      nightsUsed,
      effectivePerNight,
      estSavings,
      worthIt: m.savings_method !== 'none' && estSavings > 0,
      proratedFee,
      monthsCovered,
      acquisitionCost,
      cumulativeNetSavings,
      acquisitionRemaining,
      projectedPaybackDate,
    };
  });

  const membershipData: MembershipData = {
    rows: membershipRowsComputed,
    avgPaidPerNight,
    yearsCount,
  };

  /* ── Solar ROI ────────────────────────────────────────────────── */
  let solarFullNights     = 0;
  let solarElectricNights = 0;
  let solarDryNights      = 0;
  let solarNullNights     = 0;
  let staysWithHookup     = 0;
  let totalStaysSolar     = 0;

  for (const s of filteredStays) {
    if (s.hookup_type === 'N/A') continue;
    totalStaysSolar++;
    const n = s.nights || 0;
    if (s.hookup_type === 'Full') {
      solarFullNights += n; staysWithHookup++;
    } else if (s.hookup_type === 'Electric' || s.hookup_type === 'Water+Electric') {
      solarElectricNights += n; staysWithHookup++;
    } else if (s.hookup_type === 'Dry') {
      solarDryNights += n; staysWithHookup++;
    } else {
      solarNullNights += n;
    }
  }

  const totalRecordedNights = solarFullNights + solarElectricNights + solarDryNights;
  const pctDryRecorded = totalRecordedNights > 0
    ? (solarDryNights / totalRecordedNights) * 100
    : 0;

  const lifetimeDryNights = allStays
    .filter(s => s.hookup_type === 'Dry' && s.arrival >= SOLAR_SYSTEM.in_service_date)
    .reduce((sum, s) => sum + (s.nights || 0), 0);

  const solarBuckets: SolarBuckets = {
    fullNights:     solarFullNights,
    electricNights: solarElectricNights,
    dryNights:      solarDryNights,
    nullNights:     solarNullNights,
  };
  const solar: SolarData = {
    buckets:             solarBuckets,
    pctDryRecorded,
    totalRecordedNights,
    staysWithHookup,
    totalStaysSolar,
    avgPaidPerNight,
    lifetimeDryNights,
  };

  /* ── Stay Length Buckets (Paid stays only) ────────────────────── */
  const bucketTotals = new Map<string, { spend: number; nights: number; count: number }>();
  BUCKETS.forEach(b => bucketTotals.set(b, { spend: 0, nights: 0, count: 0 }));

  // Harvest Host excluded — only paid campground stays show the nightly-rate pattern
  const eligibleLengthStays = filteredStays.filter(
    s => s.stay_type === 'Paid' &&
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
    solar,
  };
}
