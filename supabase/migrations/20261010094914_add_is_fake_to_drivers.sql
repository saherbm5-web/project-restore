/*
# Add is_fake column to drivers

## Overview
Add a boolean `is_fake` column to the `drivers` table to distinguish real drivers
from test/fake drivers used for demo purposes. This lets the app filter out fake
drivers from the live map and ride assignment.

## Changes
### 1. New column
- `is_fake` (boolean, default false) on `drivers` table

### 2. Mark known fake/test drivers
- Drivers with names "Ahmed Irbid", "Mohammad Irbid", "Ali Irbid" (phones 079000000X) are fake
- All other drivers remain `is_fake = false`

## Notes
- The column defaults to false so all existing real drivers stay real
- No RLS changes needed — this is a data column, not a security column
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'is_fake') THEN
    ALTER TABLE drivers ADD COLUMN is_fake boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Mark the 3 Irbid fake drivers
UPDATE drivers SET is_fake = true WHERE phone IN ('0790000001', '0790000002', '0790000003');
