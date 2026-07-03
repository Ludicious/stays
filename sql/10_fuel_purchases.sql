-- Migration 10: Fuel & propane purchase log
-- Run against EXISTING databases (prod + AR). New databases get this table from 01_schema.sql (future).
-- REMINDER: confirm the database name in the phpMyAdmin sidebar before running on each instance.
-- CREATE TABLE IF NOT EXISTS — safe to run twice.

CREATE TABLE IF NOT EXISTS fuel_purchases (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  purchase_date DATE NOT NULL,
  fuel_type     ENUM('Diesel','Gasoline','DEF','Propane') NOT NULL,
  total_cost    DECIMAL(8,2) NOT NULL,
  gallons       DECIMAL(7,3) NULL,
  odometer      INT UNSIGNED NULL,
  notes         VARCHAR(255) NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fuel_date (purchase_date),
  INDEX idx_fuel_type (fuel_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
