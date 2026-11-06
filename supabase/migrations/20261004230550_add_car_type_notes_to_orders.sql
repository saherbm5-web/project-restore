/*
# Add car_type and notes columns to orders table

1. Modified Tables
- `orders`: Added `car_type` (text, nullable) and `notes` (text, nullable) columns.
  These allow customers to optionally specify a preferred car type and add notes
  to their ride request.

2. Security
- No RLS changes — existing anon/authenticated policies on `orders` already allow
  INSERT and UPDATE with no additional restrictions on these columns.
*/

ALTER TABLE orders ADD COLUMN IF NOT EXISTS car_type text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes text;
