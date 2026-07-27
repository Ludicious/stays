-- Migration 14: fuel settlement, state, and fill-quality tracking
--
-- !! CONFIRM the database name in the phpMyAdmin sidebar before running !!
-- Run prod (u946445810_stays) first, then AR (u946445810_stays_ar) separately.
--
-- Four additive columns on fuel_purchases:
--   discount_amount  DECIMAL(8,2) NULL     — delayed discount from programs like TSD Open Roads
--   settled          TINYINT(1) DEFAULT 1  — 0 = provisional (pump entry); 1 = final net cost confirmed
--   full_fill        TINYINT(1) DEFAULT 1  — 0 = partial (pump cap / known-partial); 1 = full (default)
--   state_code       VARCHAR(10) NULL       — soft ref to states(code); no FK (charset mismatch risk on shared hosting)
--                                            API validates state_code exists in states before writing.
--
-- total_cost always means the SETTLED NET amount — what actually hit the account.
-- discount_amount is display-only. full_fill = 1 is the default; historical rows keep that assumption.

ALTER TABLE fuel_purchases
  ADD COLUMN discount_amount DECIMAL(8,2) NULL             AFTER total_cost,
  ADD COLUMN settled         TINYINT(1) NOT NULL DEFAULT 1 AFTER discount_amount,
  ADD COLUMN full_fill       TINYINT(1) NOT NULL DEFAULT 1 AFTER odometer,
  ADD COLUMN state_code      VARCHAR(10) NULL              AFTER full_fill;

-- Verification — run immediately after on each instance to confirm the columns landed
SELECT
  COUNT(*)                 AS total_rows,
  SUM(settled    = 0)      AS unsettled_rows,
  SUM(full_fill  = 0)      AS partial_fill_rows,
  SUM(state_code IS NULL)  AS missing_state_rows
FROM fuel_purchases;
