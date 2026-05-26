export type StayStatus =
  | 'Booked'
  | 'Deposit Paid'
  | 'Paid in Full'
  | 'Stayed'
  | 'Cancelled';

export type StayType = 'Paid' | 'Boondocking' | 'Harvest Host' | 'Free';

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
  program: string | null;
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

export interface Membership {
  id: number;
  name: string;
  annual_fee: number;
  discount_desc: string | null;
  active: boolean;
  notes: string | null;
}

export interface State {
  code: string;
  name: string;
  country: string;
}
