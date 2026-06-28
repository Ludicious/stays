import type { StayType, SiteCategory } from './types';

export type ImportFormat = 'rvlife' | 'template';

export interface ParsedStay {
  tempId:                number;
  name:                  string;
  arrival:               string;       // YYYY-MM-DD
  departure:             string;       // YYYY-MM-DD
  full_address:          string | null;
  website:               string | null;
  phone:                 string | null;
  email:                 string | null;
  lat:                   number | null;
  lng:                   number | null;
  total_charged:         number;
  deposit_paid:          number;
  confirmation_number:   string | null;
  notes:                 string | null;
  city:                  string | null;
  state:                 string | null;
  country:               string | null;
  // Suggestions — displayed as defaults in the preview
  suggested_stay_type:         StayType;
  suggested_membership_name:   string | null;  // membership.name — resolved to FK in commit
  suggested_site_category:     SiteCategory | null;
  // Flags
  name_is_address_like:  boolean;
  is_duplicate:          boolean;
  duplicate_of_id:       number | null;
  duplicate_of_arrival:  string | null;
}

export interface ParseSummary {
  total:            number;
  duplicatesFound:  number;
  addressLikeNames: number;
}

export interface ParseResponse {
  stays:   ParsedStay[];
  summary: ParseSummary;
  error?:  string;
}

export interface CommitStay {
  tempId:               number;
  skip:                 boolean;
  name:                 string;
  arrival:              string;
  departure:            string;
  full_address:         string | null;
  website:              string | null;
  phone:                string | null;
  email:                string | null;
  lat:                  number | null;
  lng:                  number | null;
  total_charged:        number;
  deposit_paid:         number;
  confirmation_number:  string | null;
  notes:                string | null;
  city:                 string | null;
  state:                string | null;
  country:              string | null;
  stay_type:            StayType;
  membership_name:      string | null;  // resolved to membership_id by the commit route
  site_category:        SiteCategory | null;
}

export interface CommitResponse {
  imported:    number;
  errors:      Array<{ tempId: number; name: string; error: string }>;
  hasUpcoming: boolean;
  error?:      string;
}
