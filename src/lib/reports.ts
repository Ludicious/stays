import { getPool } from '@/lib/db';
import { sweepStaleStatuses } from '@/lib/stayStatus';
import type { Stay, Membership, MembershipPeriod, FuelPurchase } from '@/lib/types';
import type { RowDataPacket } from 'mysql2';
import { SOLAR_SYSTEM } from '@/lib/solar';
import type {
  BigPictureData, StayTypeData, TrendsData,
  GeographyRow, MembershipRow, MembershipData,
  LengthBucket, SolarBuckets, SolarData, ReportData,
  FuelData, FuelEfficiencyData,
} from '@/lib/report-types';

// Re-export everything from report-types so existing imports keep working
export type {
  BigPictureData, StayTypeData, TrendsData, MonthlyByYearRow,
  GeographyRow, MembershipRow, MembershipData, LengthBucket,
  SolarBuckets, SolarData, ReportData,
  FuelData, FuelSpendRow, FuelStateRow, FuelEfficiencyData, FuelSavingsData,
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

function computeFuelEfficiency(rows: FuelPurchase[]): FuelEfficiencyData {
  const diesel = rows
    .filter(r => r.fuel_type === 'Diesel')
    .sort((a, b) => a.purchase_date.localeCompare(b.purchase_date));

  const endpoints = diesel
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.odometer != null && r.full_fill);

  if (endpoints.length < 2) {
    return { hasEnoughData: false, avgMpg: null, avgCostPerMile: null, segmentCount: 0, totalMilesTracked: 0 };
  }

  let totalMiles = 0, totalGallonsInBrackets = 0, totalCostInBrackets = 0, segments = 0;

  for (let k = 0; k < endpoints.length - 1; k++) {
    const start = endpoints[k];
    const end   = endpoints[k + 1];
    const miles = (end.r.odometer as number) - (start.r.odometer as number);
    if (miles <= 0) continue; // guard against duplicate / bad odometer entries

    const bracket    = diesel.slice(start.i, end.i + 1); // inclusive of both endpoints
    const gallonsSum = bracket.reduce((sum, r) => sum + (r.gallons || 0), 0);
    const costSum    = bracket.reduce((sum, r) => sum + r.total_cost, 0);

    totalMiles             += miles;
    totalGallonsInBrackets += gallonsSum;
    totalCostInBrackets    += costSum;
    segments++;
  }

  if (segments === 0 || totalGallonsInBrackets === 0) {
    return { hasEnoughData: false, avgMpg: null, avgCostPerMile: null, segmentCount: 0, totalMilesTracked: 0 };
  }

  return {
    hasEnoughData:     true,
    avgMpg:            totalMiles / totalGallonsInBrackets,
    avgCostPerMile:    totalCostInBrackets / totalMiles,
    segmentCount:      segments,
    totalMilesTracked: totalMiles,
  };
}

/* ── Core computation (server-only) ─────────────────────────────── */
export async function computeReports(year: string): Promise<ReportData> {
  const pool = getPool();

  // Flip any stale pre-departure statuses to 'Stayed' before reading, so all
  // downstream metrics operate on accurate status values.
  await sweepStaleStatuses(pool);

  const [[staysRows], [membershipRows], [fuelRows]] = await Promise.all([
    pool.query<RowDataPacket[]>('SELECT * FROM stays ORDER BY arrival ASC'),
    pool.query<RowDataPacket[]>('SELECT * FROM memberships ORDER BY name ASC'),
    pool.query<RowDataPacket[]>('SELECT * FROM fuel_purchases ORDER BY purchase_date ASC'),
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

  const allStays    = staysRows      as Stay[];
  const memberships = membershipRows as Membership[];
  const allFuel     = fuelRows       as FuelPurchase[];

  // today used both for outstandingBalance (unchanged) and for upcomingStays derivation
  const today = new Date().toISOString().slice(0, 10);

  // completed = nights actually taken; upcoming = booked but not yet departed.
  // Cancelled excluded from both — cancellation is intentional and never auto-cleared.
  const completedStays = allStays.filter(s => s.status === 'Stayed');
  const upcomingStays  = allStays.filter(s =>
    (s.status === 'Booked' || s.status === 'Deposit Paid' || s.status === 'Paid in Full')
    && s.departure >= today
  );

  // All report metrics use completedStays as their base so booked-but-not-taken
  // and cancelled stays never pollute actuals.
  const filteredStays = year === 'all'
    ? completedStays
    : completedStays.filter(s => s.arrival.startsWith(year));

  // Fuel: every row represents fuel already purchased — no status filtering needed.
  const filteredFuel = year === 'all'
    ? allFuel
    : allFuel.filter(f => f.purchase_date.startsWith(year));

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

  // Outstanding balance — live from today, NOT filtered by year (intentionally reads allStays)
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
  // Year list and historical charts use completedStays — upcoming years add no useful filter option
  const allYears = [...new Set(completedStays.map(s => s.arrival.slice(0, 4)))].sort();

  const yearTotalsMap = new Map<string, number>();
  for (const s of completedStays) {
    const y = s.arrival.slice(0, 4);
    yearTotalsMap.set(y, (yearTotalsMap.get(y) ?? 0) + (s.total_charged || 0));
  }
  const yearTotals = allYears.map(y => ({ year: y, spend: yearTotalsMap.get(y) ?? 0 }));

  const mbyMap = new Map<number, Record<string, number>>();
  for (let m = 1; m <= 12; m++) mbyMap.set(m, {});
  for (const s of completedStays) {
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

  // All-time avg paid rate for lifetime capital computation (ignores year filter, completed only)
  const allPaidEligible = completedStays.filter(s => (s.total_charged || 0) > 0 && (s.nights || 0) > 0);
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

    // ── Capital computation (lifetime, completedStays scoped to acquisition_date+) ──
    // Only computed when acquisition_cost is set AND periods exist (both require migration 13)
    const acquisitionCost = m.acquisition_cost ?? null;
    let cumulativeNetSavings:         number | null = null;
    let acquisitionRemaining:         number | null = null;
    let projectedPaybackDate:         string | null = null;
    let projectedNightsUpcoming:      number | null = null;
    let projectedCumulativeIfBooked:  number | null = null;
    let projectedRemainingIfBooked:   number | null = null;
    let projectedPaybackDateIfBooked: string | null = null;

    if (acquisitionCost != null && m.acquisition_date && periodsForMembership.length > 0) {
      // Filter to completed stays on or after acquisition_date only
      const acqDateStr    = m.acquisition_date;
      const allMStays     = completedStays.filter(
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

      // ── Upcoming projection (if upcoming stays complete as planned) ──
      const upcomingMStays = upcomingStays.filter(
        s => s.membership_id === m.id && s.arrival >= acqDateStr
      );
      if (upcomingMStays.length > 0) {
        projectedNightsUpcoming = upcomingMStays.reduce((sum, s) => sum + (s.nights || 0), 0);

        // Value upcoming nights using the same savings method as the completed calc
        let upcomingValue = 0;
        if (m.savings_method === 'free_vs_avg') {
          upcomingValue = projectedNightsUpcoming * allAvgPaidPerNight;
        } else if (m.savings_method === 'percent_off' && m.discount_percent != null) {
          const pct = m.discount_percent / 100;
          const upcomingSpend = upcomingMStays.reduce((sum, s) => sum + (s.total_charged || 0), 0);
          upcomingValue = (upcomingSpend / (1 - pct)) * pct;
        } else if (m.savings_method === 'per_stay_value' && m.per_stay_value != null) {
          upcomingValue = upcomingMStays.length * m.per_stay_value;
        }

        projectedCumulativeIfBooked = cumulativeNetSavings + upcomingValue;
        projectedRemainingIfBooked  = Math.max(0, acquisitionCost - projectedCumulativeIfBooked);

        if (projectedRemainingIfBooked === 0) {
          // Find the specific stay that crosses the payback threshold
          const sortedUpcoming = [...upcomingMStays].sort((a, b) => a.arrival.localeCompare(b.arrival));
          let cumSoFar = cumulativeNetSavings;
          for (const s of sortedUpcoming) {
            let stayValue = 0;
            if (m.savings_method === 'free_vs_avg') {
              stayValue = (s.nights || 0) * allAvgPaidPerNight;
            } else if (m.savings_method === 'percent_off' && m.discount_percent != null) {
              const pct = m.discount_percent / 100;
              stayValue = ((s.total_charged || 0) / (1 - pct)) * pct;
            } else if (m.savings_method === 'per_stay_value' && m.per_stay_value != null) {
              stayValue = m.per_stay_value;
            }
            cumSoFar += stayValue;
            if (cumSoFar >= acquisitionCost) {
              projectedPaybackDateIfBooked = s.arrival.slice(0, 7); // YYYY-MM
              break;
            }
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
      projectedNightsUpcoming,
      projectedCumulativeIfBooked,
      projectedRemainingIfBooked,
      projectedPaybackDateIfBooked,
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

  const lifetimeDryNights = completedStays
    .filter(s => s.hookup_type === 'Dry' && s.arrival >= SOLAR_SYSTEM.in_service_date)
    .reduce((sum, s) => sum + (s.nights || 0), 0);

  const upcomingDryNightsRaw = upcomingStays
    .filter(s => s.hookup_type === 'Dry' && s.arrival >= SOLAR_SYSTEM.in_service_date)
    .reduce((sum, s) => sum + (s.nights || 0), 0);
  const projectedUpcomingDryNights = upcomingDryNightsRaw > 0 ? upcomingDryNightsRaw : null;

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
    projectedUpcomingDryNights,
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

  /* ── Fuel ────────────────────────────────────────────────────── */
  const fuelTotalSpend   = filteredFuel.reduce((sum, f) => sum + f.total_cost, 0);
  const fuelTotalGallons = filteredFuel.reduce((sum, f) => sum + (f.gallons || 0), 0);

  // By fuel type — all types included (Diesel, DEF, Gasoline, Propane, …)
  const byFuelTypeMap = new Map<string, { gallons: number; spend: number }>();
  for (const f of filteredFuel) {
    const prev = byFuelTypeMap.get(f.fuel_type) ?? { gallons: 0, spend: 0 };
    byFuelTypeMap.set(f.fuel_type, {
      gallons: prev.gallons + (f.gallons || 0),
      spend:   prev.spend   + f.total_cost,
    });
  }
  const byFuelType = Array.from(byFuelTypeMap.entries())
    .map(([fuelType, { gallons, spend }]) => ({
      fuelType, gallons, spend,
      avgPrice: gallons > 0 ? spend / gallons : null,
    }))
    .sort((a, b) => b.spend - a.spend);

  // By state — null state_code rows silently excluded
  const byStateMap = new Map<string, { gallons: number; spend: number; fillCount: number }>();
  for (const f of filteredFuel) {
    if (!f.state_code) continue;
    const prev = byStateMap.get(f.state_code) ?? { gallons: 0, spend: 0, fillCount: 0 };
    byStateMap.set(f.state_code, {
      gallons:   prev.gallons   + (f.gallons || 0),
      spend:     prev.spend     + f.total_cost,
      fillCount: prev.fillCount + 1,
    });
  }
  const byState = Array.from(byStateMap.entries())
    .map(([stateCode, { gallons, spend, fillCount }]) => ({ stateCode, gallons, spend, fillCount }))
    .sort((a, b) => b.spend - a.spend);

  // By month — grouped by YYYY-MM, displayed as "Jan '24" (all) or "Jan" (specific year)
  const fuelMonthMap = new Map<string, number>(); // YYYY-MM → spend
  for (const f of filteredFuel) {
    const ym = f.purchase_date.slice(0, 7);
    fuelMonthMap.set(ym, (fuelMonthMap.get(ym) ?? 0) + f.total_cost);
  }
  const byMonth: { month: string; spend: number }[] = year === 'all'
    ? Array.from(fuelMonthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([ym, spend]) => ({
          month: `${MONTH_LABELS[parseInt(ym.slice(5, 7), 10) - 1]} '${ym.slice(2, 4)}`,
          spend,
        }))
    : Array.from({ length: 12 }, (_, i) => ({
        month: MONTH_LABELS[i],
        spend: fuelMonthMap.get(`${year}-${String(i + 1).padStart(2, '0')}`) ?? 0,
      }));

  // All-in cost per night: fuel + lodging spend over lodging nights (computed after bigPicture)
  const allInCostPerNight = bigPicture.totalNights > 0
    ? (fuelTotalSpend + bigPicture.totalSpend) / bigPicture.totalNights
    : null;

  // Savings: discount only confirmed on settled rows
  const totalDiscountSettled = filteredFuel
    .filter(f => f.settled)
    .reduce((sum, f) => sum + (f.discount_amount || 0), 0);
  const unsettledCount = filteredFuel.filter(f => !f.settled).length;

  const fuel: FuelData = {
    totalSpend:        fuelTotalSpend,
    totalGallons:      fuelTotalGallons,
    byFuelType,
    byState,
    byMonth,
    allInCostPerNight,
    efficiency:        computeFuelEfficiency(filteredFuel),
    savings:           { totalDiscountSettled, unsettledCount },
  };

  return {
    year,
    bigPicture,
    stayTypes,
    trends,
    geography,
    memberships: membershipData,
    lengthBuckets,
    solar,
    fuel,
  };
}
