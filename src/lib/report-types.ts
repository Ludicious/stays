/**
 * Pure type + constant definitions — no Node.js imports.
 * Safe to import from both server and client components.
 */

/* ── Palette ────────────────────────────────────────────────────── */
export const STAY_TYPE_COLORS: Record<string, string> = {
  Paid:            '#475569',
  Boondocking:     '#4d7c0f',
  'Harvest Host':  '#C9A84C',
  Free:            '#3b82f6',
};

export const YEAR_COLORS = ['#0F2238', '#C9A84C', '#4d7c0f', '#7c3aed', '#dc2626'];

/* ── Data interfaces ────────────────────────────────────────────── */
export interface BigPictureData {
  totalNights:        number;
  totalSpend:         number;
  avgCostPaidOnly:    number;
  avgCostAllStays:    number;
  freeNightsPercent:  number;
  mostExpensiveStay:  { id: number; name: string; totalCharged: number } | null;
}

export interface StayTypeData {
  pie:           { type: string; nights: number; percent: number }[];
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
  effectiveAnnualFee: number;
  nightsUsed:         number;
  effectivePerNight:  number | null;
  estSavings:         number;
  worthIt:            boolean;
}

export interface MembershipData {
  rows:            MembershipRow[];
  avgPaidPerNight: number;
  yearsCount:      number;
}

export interface LengthBucket {
  bucket:          string;
  avgCostPerNight: number | null;
  count:           number;
}

export interface ReportData {
  year:          string;
  bigPicture:    BigPictureData;
  stayTypes:     StayTypeData;
  trends:        TrendsData;
  geography:     GeographyRow[];
  memberships:   MembershipData;
  lengthBuckets: LengthBucket[];
}
