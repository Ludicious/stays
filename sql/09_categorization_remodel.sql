-- Migration 09: Stay categorization remodel — Phase 1a (data layer only)
-- Run against EXISTING databases (prod + AR). New databases get all columns from 01_schema.sql.
-- Non-destructive: IF NOT EXISTS, additive enum modifications, no column drops.
-- Step order matters — each step depends on the one above.

-- ── Step 1.1: Expand stay_type enum (additive — Boondocking/Harvest Host stay until Phase 2 cleanup) ──
ALTER TABLE stays
  MODIFY COLUMN stay_type
  ENUM('Paid','Boondocking','Harvest Host','Free','Membership','Storage') NOT NULL;

-- ── Step 1.2: Add hookup_type and site_category columns ──
ALTER TABLE stays ADD COLUMN IF NOT EXISTS hookup_type
  ENUM('Full','Water+Electric','Electric','Dry','N/A') NULL AFTER stay_type;
ALTER TABLE stays ADD COLUMN IF NOT EXISTS site_category
  ENUM('Public Land','Private Host','Commercial Lot','Campground','N/A') NULL AFTER hookup_type;

-- ── Step 1.3: Insert Harvest Host membership row ──
-- savings_method=per_stay_value because HH value is per-stay, not nights×avg-paid.
-- annual_fee and per_stay_value are placeholders — owner corrects via the memberships UI.
INSERT IGNORE INTO memberships (name, annual_fee, savings_method, per_stay_value, discount_desc)
VALUES ('Harvest Host', 0.00, 'per_stay_value', 0.00, 'One free overnight per host visit');

-- ── Step 1.4: Add membership_id FK column ──
ALTER TABLE stays ADD COLUMN IF NOT EXISTS membership_id INT NULL AFTER site_category;

-- Backfill membership_id from existing program strings.
-- NOTE: the stays table stores 'KOA' (not 'KOA Rewards') — confirmed via PROGRAM_MAP in reports.ts.
UPDATE stays s JOIN memberships m ON m.name = 'KOA Rewards'
  SET s.membership_id = m.id WHERE s.program = 'KOA';
UPDATE stays s JOIN memberships m ON m.name = 'Thousand Trails'
  SET s.membership_id = m.id WHERE s.program = 'Thousand Trails';
UPDATE stays s JOIN memberships m ON m.name = 'Good Sam'
  SET s.membership_id = m.id WHERE s.program = 'Good Sam';
UPDATE stays s JOIN memberships m ON m.name = 'Harvest Host'
  SET s.membership_id = m.id WHERE s.program = 'Harvest Host';

-- ── Orphan check — RUN THIS BEFORE the FK constraint below; expect zero rows ──
-- SELECT id, name, program FROM stays
-- WHERE program IS NOT NULL AND program <> '' AND membership_id IS NULL;

-- ── Step 1.4 continued: FK constraint (run only after orphan check returns zero rows) ──
ALTER TABLE stays
  ADD CONSTRAINT fk_stays_membership
  FOREIGN KEY (membership_id) REFERENCES memberships(id);

-- ── Step 2: Certain-mapping data migrations ──

-- Harvest Host stays → Membership type, Dry hookup, membership_id set
-- (covers rows where program was null — the JOIN handles membership_id via stay_type)
UPDATE stays s JOIN memberships m ON m.name = 'Harvest Host'
  SET s.stay_type = 'Membership', s.hookup_type = 'Dry', s.membership_id = m.id
  WHERE s.stay_type = 'Harvest Host';

-- Boondocking → Free, Dry hookup
-- site_category is NOT set in bulk here — left for parser-derived backfill and Phase 2
-- (Boondocking rows could be Public Land OR Commercial Lot; can't infer from stay_type alone)
UPDATE stays SET stay_type = 'Free', hookup_type = 'Dry'
  WHERE stay_type = 'Boondocking';

-- Storage → N/A hookup (physical site type is not meaningful for storage stays)
UPDATE stays SET hookup_type = 'N/A' WHERE stay_type = 'Storage';

-- Paid: hookup_type left NULL (unknown historically — becomes useful going forward)
-- Free (pre-existing non-boondocking): hookup_type left NULL — Phase 2 review

-- ── Step 1.5: Drop program column (GATED — do NOT run until all of the following are true) ──
-- 1. Orphan check above returns zero rows on both prod and AR databases
-- 2. reports.ts confirmed reading from membership_id (done in Phase 1a)
-- 3. Phase 1b UI changes have landed (no code reading the program column)
-- ALTER TABLE stays DROP COLUMN program;
