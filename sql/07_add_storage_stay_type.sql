-- Migration 07: Add 'Storage' to the stay_type enum
-- Run against EXISTING databases (prod + AR) created before this type existed.
-- New databases get it from 01_schema.sql and do NOT need this file.
-- Non-destructive: adding an enum value does not touch existing rows.
ALTER TABLE stays
  MODIFY COLUMN stay_type
  ENUM('Paid','Boondocking','Harvest Host','Free','Storage') NOT NULL;
