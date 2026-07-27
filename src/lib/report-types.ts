/**
 * Pure type + constant definitions — no Node.js imports.
 * Safe to import from both server and client components.
 */

/* ── Palette ────────────────────────────────────────────────────── */
export const STAY_TYPE_COLORS: Record<string, string> = {
  Paid:            '#475569',
  Free:            '#3b82f6',
  Membership:      '#7c3aed',
  Storage:         '#64748b',
  Boondocking:     '#4d7c0f',   // deprecated — kept until Phase 2 cleanup
  'Harvest Host':  '#C9A84C',  // deprecated — kept until Phase 2 cleanup
};

export const YEAR_COLORS = ['#0F2238', '#C9A84C', '#4d7c0f', '#7c3aed', '#dc2626'];

/* ── Data interfaces ────────────────────────────────────────────── */
export interface BigPictureData {
  totalNights:           number;
  totalSpend:            number;
  avgCostPaidOnly:       number;
  avgCostAllStays:       number;
  freeNightsPercent:     number;
  mostExpensiveStay:     { id: number; name: string; totalCharged: number } | null;
  mostExpensivePerNight: { id: number; name: string; perNight: number } | null;
  cheapestPaidPerNight:  { id: number; name: string; perNight: number } | null;
  outstandingBalance:    number;   // live — not filtered by year
  // Stay-mix percentages (by nights) — Paid / Membership / everything else
  paidPercent:        number;
  membershipPercent:  number;
  freePercent:        number;
}

export interface StayTypeData {
  // pct = 0–100 stored in our data; 'percent' is intentionally avoided to
  // prevent collision with recharts' own computed percent (0–1) on label props.
  pie:           { type: string; nights: number; pct: number }[];
  avgCostByType: { type: string; avgCost: number }[];
}

export type MonthlyByYearRow = Record<string, number | string>;

export interface TrendsData {
  yearTotals:     { year: string; spend: number }[];
  monthlyByYear:  MonthlyByYearRow[];
  monthlyForYear: { month: number; label: string; spend: number }[];
  years:          string[];
}

export interface GeographyRow {
  state:       string;
  country:     string;
  totalNights: number;
  totalSpend:  number;
  avgPerNight: number;
  freeNights:  number;
  freePercent: number;
}

export interface MembershipRow {
  name:               string;
  annualFee:          number;
  /** @deprecated use proratedFee — retained for backward compat while migration is in progress */
  effectiveAnnualFee: number;
  nightsUsed:         number;
  effectivePerNight:  number | null;
  estSavings:         number;
  worthIt:            boolean;
  // Tenure-based fields (populated once membership_periods rows are seeded)
  proratedFee:          number;       // sum of period fees prorated to the active filter window
  monthsCovered:        number;       // calendar months covered (0 = no periods seeded yet)
  acquisitionCost:      number | null;
  cumulativeNetSavings: number | null; // lifetime: gross savings − total dues since acquisition
  acquisitionRemaining: number | null; // max(0, acquisitionCost − cumulativeNetSavings)
  projectedPaybackDate: string | null; // YYYY-MM extrapolated from realized monthly savings rate
  // Upcoming-projection fields — null when acquisition_cost is null
  projectedNightsUpcoming:      number | null;
  projectedCumulativeIfBooked:  number | null;
  projectedRemainingIfBooked:   number | null;
  projectedPaybackDateIfBooked: string | null; // YYYY-MM of stay that crosses payback threshold
}

export interface MembershipData {
  rows:            MembershipRow[];
  avgPaidPerNight: number;
  /** @deprecated use per-row monthsCovered — retained for backward compat */
  yearsCount:      number;
}

export interface LengthBucket {
  bucket:          string;
  avgCostPerNight: number | null;
  count:           number;
}

export interface SolarBuckets {
  fullNights:     number;
  electricNights: number;
  dryNights:      number;
  nullNights:     number;
}

export interface SolarData {
  buckets:             SolarBuckets;
  pctDryRecorded:      number;
  totalRecordedNights: number;
  staysWithHookup:     number;
  totalStaysSolar:     number;
  avgPaidPerNight:     number;
  lifetimeDryNights:   number;
  projectedUpcomingDryNights: number | null; // upcoming booked Dry stays after in_service_date
}

export interface ReportData {
  year:          string;
  bigPicture:    BigPictureData;
  stayTypes:     StayTypeData;
  trends:        TrendsData;
  geography:     GeographyRow[];
  memberships:   MembershipData;
  lengthBuckets: LengthBucket[];
  solar:         SolarData;
}
