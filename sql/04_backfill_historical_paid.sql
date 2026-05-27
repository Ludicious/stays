-- Fix 1: Backfill historical paid-in-full status
--
-- The Session 1 import stored deposit_paid as the amount paid at booking time
-- only. For completed stays (status = 'Stayed') the final balance was settled
-- but never reflected in deposit_paid, creating phantom outstanding balances.
--
-- STEP 1: Preview affected rows before running the UPDATE.
--
-- SELECT id, name, arrival, total_charged, deposit_paid,
--        (total_charged - deposit_paid) AS phantom_balance
-- FROM stays
-- WHERE status = 'Stayed'
--   AND deposit_paid < total_charged
--   AND total_charged > 0
-- ORDER BY arrival;
--
-- STEP 2: Run the UPDATE once the row count looks right (~110 rows expected).

UPDATE stays
SET deposit_paid = total_charged
WHERE status = 'Stayed'
  AND deposit_paid < total_charged
  AND total_charged > 0;

-- Expected: ~110 rows affected.
-- After running, balance_due (generated column) will be 0 for all Stayed stays.
