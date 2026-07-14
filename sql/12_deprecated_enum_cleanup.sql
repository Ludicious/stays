-- sql/12_deprecated_enum_cleanup.sql
-- Phase 2 cleanup: remove deprecated stay_type enum values + drop program column
-- !! ALL STATEMENTS BELOW ARE COMMENTED OUT — DO NOT RUN UNTIL PHASE 2 IS CONFIRMED !!
--
-- Prerequisites — run BOTH checks on BOTH DBs before uncommenting anything:
--
--   1. Zero deprecated stay_type rows:
--      SELECT stay_type, COUNT(*) FROM stays
--        WHERE stay_type IN ('Boondocking', 'Harvest Host')
--        GROUP BY stay_type;
--      → Must return zero rows on BOTH instances.
--
--   2. Zero rows using the program column:
--      SELECT COUNT(*) FROM stays WHERE program IS NOT NULL;
--      → Must return 0 on BOTH instances.
--
-- How to apply when ready:
--   • Run prod (u946445810_stays) first; verify row counts; then run AR (u946445810_stays_ar).
--   • After both DBs are migrated: remove the deprecated comments from report-types.ts
--     and types.ts (StayType union + STAY_TYPE_COLORS).

/*

-- Step 1: Reduce stay_type enum to active values only
ALTER TABLE stays
  MODIFY COLUMN stay_type
    ENUM('Paid', 'Free', 'Membership', 'Storage') NOT NULL;

-- Step 2: Drop the program column (deprecated rollback safety net — no longer needed)
ALTER TABLE stays DROP COLUMN program;

*/
