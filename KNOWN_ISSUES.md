# Known Issues

---

## [RESOLVED] Quick Add — Google Maps load-order race (cold-load crash)

**Status:** Fixed (shipped in Session 8 — `quick-add/PlacesAutocomplete.tsx`)

**Symptom:** On a fresh (cold) server load, the Quick Add page caused repeated render errors that thrashed the Hostinger process ceiling (~120 processes). Users saw 503s. The Hostinger dashboard showed Max Processes spiking to the account limit within seconds of the page loading.

**Root cause:** `layout.tsx` injects the Google Maps script with `strategy="afterInteractive"`, meaning it loads asynchronously after the page is interactive. `PlacesAutocomplete` called `usePlacesAutocomplete()` unconditionally on mount. On a cold load the hook ran before `window.google.maps.places` existed, threw on every re-render, and — because an error during server-side rendering can restart the Node process — thrashed the Hostinger process manager into a crash loop.

**Why production hid it:** The primary instance (`stays.noteworthynomads.com`) had a warm Maps-script browser cache from regular use. The Google Maps JS was already present by the time the hook ran. The fresh AR instance (`stays-ar.noteworthynomads.com`) had no cache and hit the race on every cold incognito load.

**Fix:** A `useMapsReady()` guard polls for `window.google.maps.places` and renders a disabled placeholder input until the library is confirmed present. Only then is the inner `PlacesInput` component (which calls `usePlacesAutocomplete()`) mounted. This prevents the hook from running against an absent library.

**Key lesson:** A thrown error during a React render can thrash server processes on Hostinger. Any client-side hook that depends on an asynchronously loaded external script **must** be guarded behind a readiness check. Production warm-cache can mask this class of bug entirely — reproduce with an incognito cold load on a fresh instance.

**Correct reproduction method:** Open Quick Add in an incognito window on a freshly deployed instance (no prior page loads). Watch the Hostinger process count; without the fix it slams the ceiling within seconds.

---

## [OPEN] Google Places AutocompleteService deprecation

**Status:** Backlogged — non-urgent, tracked here

**Background:** Google deprecated the legacy `AutocompleteService` API for new API key holders as of March 1 2025. The existing API key is on an existing-customer grace period (12+ months notice), so the current integration continues to work.

**Affected code:** `use-places-autocomplete` relies on `AutocompleteService` under the hood. Eventually this library or the underlying API call will need to migrate to `google.maps.places.AutocompleteSuggestion` (the replacement API).

**Action:** Migrate Quick Add's Places integration from `use-places-autocomplete` / `AutocompleteService` to `google.maps.places.AutocompleteSuggestion` in a dedicated future session. Do not attempt this migration while any friend-test or new instance onboarding is in progress — the change will require testing the full Quick Add → save flow end-to-end.

**Urgency:** Low. Monitor the Google Maps JS changelog for end-of-life announcements for the existing key's grace period.

---

## [PLANNED] Stay categorization remodel — two-axis model + hookup_type

**Status:** Fully designed and locked, ready to build. Decided across a focused modeling session; do not re-derive — build to this spec.

**The problem being solved:** `stay_type` was conflating two independent dimensions, causing category collisions with no clean answer (e.g. "Free = boondocking OR Thousand Trails?", "Harvest Host = a type or a membership?"). Root cause: cost/arrangement and physical-site were jammed into one field.

**The model (two independent axes + program):**

1. **`stay_type`** = cost/arrangement axis. Values: `Paid`, `Free`, `Membership`, `Storage`.
   - `Paid` — out of pocket
   - `Free` — no cost, no membership (moochdocking, BLM, friend's driveway)
   - `Membership` — free because a program covered it (requires `program`)
   - `Storage` — RV storage

2. **`program`** = which membership applies. Meaning depends on stay_type:
   - On `Membership` stays → which membership made it free (required)
   - On `Paid` stays → which discount membership applied (optional)
   - On `Free`/`Storage` → empty

3. **`hookup_type`** (NEW column) = physical site axis, independent. Values: `Full`, `Water+Electric`, `Electric`, `Dry`, `N/A`.

**The keystone rule set:**
- `stay_type=Membership` → program REQUIRED, scoped to free-type memberships (Thousand Trails, Harvest Host)
- `stay_type=Paid` → program OPTIONAL, scoped to discount-type memberships (KOA, Good Sam, future)
- `stay_type=Free`/`Storage` → no program field shown
- This maps onto existing `savings_method`: `free_vs_avg` memberships → Membership stays; `percent_off` memberships → Paid+program stays.

**Program field design (Option A — self-filtering dropdown):**
Single `program` dropdown whose options are scoped by stay_type, driven by membership `savings_method`:
- Membership selected → shows only `free_vs_avg` memberships, required
- Paid selected → shows only `percent_off` memberships + "None", optional
- Free/Storage → field hidden
Prevents mis-tagging by making invalid options unselectable rather than validating after the fact. Reuses existing `savings_method` data. Auto-correct as memberships are added — no form-code changes needed for new memberships.

**Migration approach — TWO PHASES (do not big-bang):**

*Phase 1 (automated + tooling):* Schema migration (expand `stay_type` enum to add `Membership`; add `hookup_type` column). Automate only the CERTAIN mappings:
| Current stay_type | → new stay_type | → program | → hookup_type |
|---|---|---|---|
| Paid | Paid | unchanged (keep KOA/Good Sam) | blank |
| Storage | Storage | clear | N/A |
| Harvest Host | Membership | Harvest Host | Dry |
| Boondocking | Free | clear | Dry |
| Free | Free | clear | blank |

Also surface `program` and `hookup_type` in the stays list/detail UI, and add a "needs review" filter (e.g. Membership stays missing program, or ambiguous ex-Free/ex-Boondocking stays).

*Phase 2 (manual, via UI, at own pace):* Spot-check and hand-fix ambiguous historical stays — old `Free` stays that were actually Thousand Trails → change to Membership+program; ex-Boondocking that were membership stays → correct. Use the review filter to find them.

**Locked decisions:**
- Harvest Host hookup default = `Dry`, ALWAYS (owner has never used HH hookups; will update individual stays if that ever changes).
- All Thousand Trails stays are already `Free`/$0 — migration only relabels to `Membership`+program, does NOT touch cost.
- hookup_type will be blank/unknown for most historical stays — acceptable; it becomes useful going forward (same logic as the program dropdown rollout).

**Verification gate:** After migration, VALIDATE (do not assume) that ROI still computes correctly — Membership stays feed `free_vs_avg` math, Paid+program stays feed `percent_off` math.

**Unlocks:** the long-planned cost-by-hookup-type report.

---

## [CONVENTIONS] Data-entry rules that protect ROI integrity

These are owner conventions, not bugs. They exist because `avgPaidPerNight` (spend ÷ paid nights, computed in `reports.ts`) is load-bearing: it is the offset rate for Solar ROI and the baseline for membership `free_vs_avg` savings. Anything that pollutes `total_charged` skews every ROI number downstream.

* Event fees do not belong in `total_charged`. When a stay's cost is mostly an event (e.g. ABQ Balloon Fiesta: ~$450 event fee, dry-camped in a lot), enter only the true camping portion in `total_charged` (often $0) and record the event cost in `notes`. If the fee is genuinely inseparable, prefer $0-with-note over a guessed split — a guess still nudges `avgPaidPerNight`.
* Paid dry stays count as solar nights by design. A paid campground/provincial-park site with no hookups is `stay_type=Paid` + `hookup_type=Dry` and lands in the Solar ROI Dry bucket alongside free boondocking — the solar system did identical work either way. The slight offset overcount (you paid for the site anyway) is accepted and disclosed in the panel footnote. Do not "fix" this by excluding paid dry nights.
* Solar offset is directional, not audited. Dry nights × avgPaidPerNight estimates avoided powered-site cost. Some dry nights would have been free regardless. The panel footnote states this; keep it.

---

## [LESSON] Migration discipline — additive first, destructive gated

From the stay-categorization remodel (sql/09, Phases 1a/1b):

* Never drop an enum value or column in the same migration that stops using it. MySQL `MODIFY COLUMN` fails if rows still reference a removed enum value. Deprecated values (`Boondocking`, `Harvest Host`) stay in the enum until a review filter proves zero rows reference them; a separate cleanup migration removes them.
* Gate destructive steps on validation queries, not assumptions. The `program` column drop is a commented-out statement at the bottom of sql/09, runnable only after: (1) the orphan check (`program` set but `membership_id` null) returns zero rows on BOTH databases, (2) no code reads the column.
* Backfill before constraint. Add the FK column → backfill → orphan-check → only then add the constraint.
* Split data-layer and UI phases (1a/1b pattern). Prove the data layer clean in isolation before any form code touches it.

---

## [LESSON] Foreign keys over string joins

The old `program` VARCHAR joined stays to memberships by string match, which required a hardcoded alias map (`PROGRAM_MAP: 'KOA Rewards' → 'KOA'`) because the stored strings drifted from membership names. Every new membership risked a new alias. Replaced by `membership_id` FK; the alias map is deleted. Rule: if two tables are related, relate them with a key, not a matching string. Same reasoning killed the free-text `program` field's self-inflicted typo risk.

---

## [LESSON] Savings method must match the membership's actual economics

Harvest Host was nearly seeded as `free_vs_avg` (like Thousand Trails) because both "make stays free." But TT displaces many paid campground nights (nights × avgPaidPerNight is honest); HH is one free overnight per host visit where the alternative was often free boondocking anyway — `per_stay_value` is the honest bucket. Classify memberships by what the money actually displaces, not by surface similarity. The self-filtering program dropdown scopes on `savings_method IN ('free_vs_avg','per_stay_value')` for Membership stays vs `percent_off` for Paid — driven by data, zero hardcoded membership names.

---

## [LESSON] Lifetime metrics ignore the year filter; period metrics respect it

Solar payback (offset $ and % toward system cost) is computed lifetime-since-`in_service_date`, deliberately ignoring the reports year filter — a one-time investment's payback is cumulative and shouldn't swing with a dropdown. The hookup-nights bars DO respect the filter. Precedent: `outstandingBalance` was already exempt from year filtering. When adding report stats, decide explicitly which class each number belongs to and comment it in code.

---

## [LESSON] Config placeholders silently shape headline stats

`SOLAR_SYSTEM.in_service_date` shipped as a placeholder and quietly bounded the payback calculation until noticed. The itemized cost breakdown drifted from the owner's real figures without anyone noticing (totals matched; components didn't). Both are the same failure: config constants don't get validated by tsc or builds. Rules: (1) placeholder config values get a loud OWNER comment and a merge-blocking mention in the kickoff prompt's verification gate; (2) don't itemize config beyond proven need — every extra number is another thing that can silently drift. (The itemization was dropped for exactly this reason.)

---

## [OPERATIONS] phpMyAdmin two-windows hazard

Migrations run manually on BOTH databases (`u946445810_stays`, `u946445810_stays_ar`). Two phpMyAdmin windows have previously BOTH pointed at the same database, running a migration twice on one DB and zero times on the other. Always confirm the database name in the phpMyAdmin sidebar immediately before executing each migration. Every kickoff prompt with a migration carries this reminder.

---

## [OPERATIONS] Friend-test signal hygiene (AR instance)

The AR instance exists to measure unprompted behavior against pre-committed gates (e.g. A1: will spreadsheet users sustain fuel logging over 30 days). A single push to main deploys both instances, so shipping a feature starts its measurement clock. Announce that a feature exists once; never nudge usage — prompted engagement contaminates the exact signal the gate measures. Simulated-panel outputs (personas, WTP figures) are hypotheses only; real AR signal outranks them.

---

## [RESOLVED] Membership fee basis derived from stay-years instead of tenure

**Status:** Fixed in Migration 13 (`sql/13_membership_tenure.sql`, shipped in `feat: migration 13 — membership tenure + acquisition cost`)

**Symptom:** The Membership ROI table showed wildly wrong "effective annual fee" when filtering by a single year. For Thousand Trails, a year with 12 nights showed an inflated fee basis because the report treated the membership as only covering that year, not its full tenure.

**Root cause:** `yearsCount` in `computeReports()` was computed as `new Set(filteredStays.map(s => new Date(s.check_in).getFullYear())).size` — the count of distinct calendar years in the *current filter window*. This was then multiplied by `annual_fee` to get the effective fee basis. Filtering to a single year → `yearsCount = 1` → fee = 1× annual_fee regardless of how many years the membership had been held.

**Fix:** New `membership_periods` child table stores one row per fee-rate period per membership, with `start_date` / `end_date` (NULL = still active). `proratedFeeForPeriods()` in `reports.ts` computes the overlap between each period's date range and the active filter window, counting calendar months (partial months count as whole). This gives a fee basis that correctly scales with the filter window relative to actual membership tenure.

**`yearsCount` and `effectiveAnnualFee`** kept with `@deprecated` comments for backward compat; no code multiplies by `yearsCount` in the ROI path as of this migration.

**Key lesson:** Fee basis must be anchored to real membership dates, not inferred from stay data in the filter window. Stay data is sparse and filter-dependent; period dates are authoritative.

---

## [CONVENTIONS] Fuel total_cost is settled net; discount_amount is display-only

`total_cost` on `fuel_purchases` is always the **settled net amount** — what actually hit the account. Discount programs (TSD Open Roads and similar) post savings days after the pump transaction; rows entered at the pump are provisional (`settled = 0`) until the invoice lands and the discount is known. `discount_amount` is display-only and may not perfectly net out a card program's own transaction fee — do not adjust it to back out fees. **Never derive cost/mile or any spend metric from anything but `total_cost`.**

Efficiency metrics (MPG, cost/mile) use bracket logic between full, odometer'd Diesel fills:

* Only `fuel_type = 'Diesel'` rows count as drive fuel. DEF and Propane are excluded from efficiency calculations entirely (they still count toward spend/gallons totals).
* A bracket segment exists between two chronologically adjacent Diesel rows that both have `odometer IS NOT NULL` and `full_fill = 1`.
* All Diesel purchases between those two endpoints (partial fills, missing odometer) contribute their `gallons` and `total_cost` to that bracket's totals. Only the endpoints need to qualify.
* `miles = odometer_end − odometer_start`. `MPG = miles / Σgallons in bracket`. `cost_per_mile = Σtotal_cost in bracket / miles`.
* Fewer than two qualifying endpoints → efficiency metrics are **absent** (not zero, not estimated). Surface as "not enough data yet," not an error.

---

## [PLANNED] Multi-vehicle fuel tracking

Current schema assumes one vehicle — validated correct for this household (single truck, always the same tank and odometer). A household running a motorhome + toad would need a `vehicles` table and a `vehicle_id` FK on `fuel_purchases`, with MPG bracketing partitioned by vehicle. Without it, fills from two different vehicles could be silently paired into a nonsense MPG segment. Not built: no real multi-vehicle household to validate the UX against.

---

## [PLANNED] membership_periods CRUD UI

**Status:** Backlogged — follow-up to Migration 13

**Background:** `membership_periods` rows must currently be managed via direct SQL (phpMyAdmin). The backfill in `sql/13_membership_tenure.sql` seeds one period per membership with a placeholder `start_date = '2000-01-01'` that the owner must correct. If annual fees change in the future, a new period row must be inserted manually.

**Scope:** Add a collapsible "Fee history" section inside the Memberships page (`src/app/memberships/page.tsx`) that lists `membership_periods` rows for each membership and allows add/edit/delete. Requires a new `/api/memberships/[id]/periods` route (GET, POST) and `/api/memberships/[id]/periods/[pid]` (PATCH, DELETE).

**Urgency:** Low — current fee rates are stable. Build before the next annual fee change or before any new capital membership is added.
