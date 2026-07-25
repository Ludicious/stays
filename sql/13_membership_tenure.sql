-- ============================================================
-- Migration 13: membership_periods table + acquisition cost
-- ============================================================
-- PURPOSE: Fix the fee-basis bug (yearsCount derived from stay
--   data instead of actual membership tenure) and add acquisition
--   cost tracking for capital-investment memberships.
--
-- BEFORE RUNNING:
--   1. Confirm the database name in the phpMyAdmin sidebar.
--   2. Run on prod (u946445810_stays) FIRST, then AR (u946445810_stays_ar).
--   3. Fill in all OWNER REQUIRED placeholders before executing.
-- ============================================================

-- ── 1. New table: membership_periods ─────────────────────────────
CREATE TABLE IF NOT EXISTS membership_periods (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  membership_id INT NOT NULL,
  start_date    DATE NOT NULL,
  end_date      DATE NULL,                    -- NULL = current active period
  annual_fee    DECIMAL(8,2) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (membership_id) REFERENCES memberships(id),
  INDEX idx_mp_membership (membership_id),
  INDEX idx_mp_start      (start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 2. Add acquisition columns to memberships ─────────────────────
ALTER TABLE memberships
  ADD COLUMN acquisition_cost DECIMAL(10,2) NULL AFTER annual_fee,
  ADD COLUMN acquisition_date DATE          NULL AFTER acquisition_cost;

-- ── 3. Backfill: seed one period row per active membership ────────
-- OWNER REQUIRED: After running this INSERT, update start_date for
--   each row to the actual date that membership was first activated.
--   Use the query in section 5 to identify each row, then run:
--     UPDATE membership_periods
--       SET start_date = '20XX-XX-XX'
--     WHERE membership_id = <id>;
INSERT INTO membership_periods (membership_id, start_date, annual_fee)
  SELECT id, '2000-01-01', annual_fee
  FROM memberships
  WHERE active = TRUE;

-- ── 4. Set Thousand Trails acquisition cost ───────────────────────
-- Acquisition cost: $3,500 purchase + $750 transfer fee = $4,250.
-- OWNER REQUIRED: Replace '2000-01-01' with the actual purchase date.
UPDATE memberships
  SET acquisition_cost = 4250.00,
      acquisition_date = '2000-01-01'
  WHERE name = 'Thousand Trails';

-- All other memberships: acquisition_cost and acquisition_date remain NULL.

-- ── 5. Verification: list every membership + its period rows ──────
SELECT
  m.id,
  m.name,
  m.annual_fee,
  m.acquisition_cost,
  m.acquisition_date,
  mp.id          AS period_id,
  mp.start_date,
  mp.end_date,
  mp.annual_fee  AS period_fee
FROM memberships m
LEFT JOIN membership_periods mp ON mp.membership_id = m.id
ORDER BY m.name, mp.start_date;
