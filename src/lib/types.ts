export type StayStatus =
  | 'Booked'
  | 'Deposit Paid'
  | 'Paid in Full'
  | 'Stayed'
  | 'Cancelled';

export type StayType =
  | 'Paid'
  | 'Free'
  | 'Membership'
  | 'Storage'
  | 'Boondocking'    // deprecated — removed after Phase 2 cleanup migration
  | 'Harvest Host';  // deprecated — removed after Phase 2 cleanup migration

export type HookupType = 'Full' | 'Water+Electric' | 'Electric' | 'Dry' | 'N/A';

export type SiteCategory = 'Public Land' | 'Private Host' | 'Commercial Lot' | 'Campground' | 'N/A';

export interface Stay {
  id: number;
  name: string;
  city: string | null;
  state: string | null;
  country: string;
  full_address: string | null;
  lat: number | null;
  lng: number | null;
  place_id: string | null;
  arrival: string;     // YYYY-MM-DD
  departure: string;   // YYYY-MM-DD
  nights: number;
  stay_type: StayType;
  hookup_type: HookupType | null;
  site_category: SiteCategory | null;
  membership_id: number | null;
  membership_name?: string | null;  // JOIN-derived — present in list/upcoming queries, absent in single-row PATCH responses
  program: string | null;  // deprecated — retiring after Phase 2; col kept as rollback safety net
  status: StayStatus;
  total_charged: number;
  deposit_paid: number;
  balance_due: number;
  confirmation_number: string | null;
  gate_code: string | null;
  check_in_time: string | null;
  check_in_instructions: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type SavingsMethod = 'percent_off' | 'free_vs_avg' | 'per_stay_value' | 'none';

export interface Membership {
  id: number;
  name: string;
  annual_fee: number;
  savings_method: SavingsMethod;
  discount_percent: number | null;
  per_stay_value: number | null;
  discount_desc: string | null;
  affiliate_url: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface State {
  code: string;
  name: string;
  country: string;
}
