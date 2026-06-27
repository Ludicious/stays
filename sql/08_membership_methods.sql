-- Migration 08: Add savings_method, discount_percent, per_stay_value, affiliate_url, timestamps to memberships
-- Run against EXISTING databases (prod + AR) created before this change.
-- New databases get all columns from 01_schema.sql and do NOT need this file.
-- Non-destructive: IF NOT EXISTS skips columns that already exist (MySQL 8.0.3+).

ALTER TABLE memberships ADD COLUMN IF NOT EXISTS savings_method   ENUM('percent_off','free_vs_avg','per_stay_value','none') NOT NULL DEFAULT 'none' AFTER annual_fee;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2)  NULL AFTER savings_method;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS per_stay_value   DECIMAL(10,2) NULL AFTER discount_percent;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS affiliate_url    VARCHAR(500)  NULL AFTER discount_desc;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER notes;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- Backfill savings methods for the three existing memberships
UPDATE memberships SET savings_method = 'free_vs_avg', discount_percent = NULL  WHERE name = 'Thousand Trails';
UPDATE memberships SET savings_method = 'percent_off', discount_percent = 10.00 WHERE name = 'KOA Rewards';
UPDATE memberships SET savings_method = 'percent_off', discount_percent = 10.00, annual_fee = 30.00 WHERE name = 'Good Sam';
