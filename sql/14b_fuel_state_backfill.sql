-- Migration 14b: Fuel state backfill
--
-- STEP 1: Run the preview SELECT below on EACH instance and eyeball the state_guess column.
-- Do NOT run the UPDATE until you have reviewed the preview output and confirmed each guess.
--
-- Known gap: rows whose notes contain city names only (e.g. "Idaho Falls") have no state
-- token and will show NULL for state_guess. Those need a manual:
--   UPDATE fuel_purchases SET state_code = 'ID' WHERE id IN (...);
-- after you identify them in the preview.
--
-- REMINDER: preview against AR's own data separately before backfilling there —
-- AR notes formatting may differ.

-- ── PREVIEW (run this first, do not UPDATE yet) ──────────────────────────────────
SELECT
  id,
  purchase_date,
  notes,
  COALESCE(
    -- Two-letter state code immediately before a trailing 5-digit ZIP
    REGEXP_SUBSTR(notes, '[A-Z]{2}(?=[[:space:]]+[0-9]{5}$)'),
    -- Two-letter state code at end of string when no ZIP follows
    REGEXP_SUBSTR(notes, '[A-Z]{2}$')
  ) AS state_guess
FROM fuel_purchases
ORDER BY purchase_date;


-- ── UPDATE (run ONLY after reviewing the preview above) ─────────────────────────
-- Uncomment and run once you are satisfied the guesses are correct.
-- Rows where state_guess is NULL will not be updated (COALESCE result is NULL → no-op).

/*
UPDATE fuel_purchases
SET state_code = COALESCE(
  REGEXP_SUBSTR(notes, '[A-Z]{2}(?=[[:space:]]+[0-9]{5}$)'),
  REGEXP_SUBSTR(notes, '[A-Z]{2}$')
)
WHERE state_code IS NULL
  AND notes IS NOT NULL;
*/
