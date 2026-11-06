/*
# Add configurable included distance to live ride pricing

1. New Columns
- `pricing_settings.included_km`: distance in kilometers covered by the base fare before per-kilometer charges begin. Defaults to 3 to preserve the existing fare behavior.

2. Modified Tables
- `pricing_settings`: adds the admin-controlled included distance used by live and final fare calculations.

3. Security
- No new table or policy is introduced. Existing pricing_settings RLS and policies remain unchanged.

4. Important Notes
- This is additive and preserves existing pricing values.
- The value is constrained to 2 or 3 kilometers because those are the supported business options.
*/

ALTER TABLE pricing_settings
  ADD COLUMN IF NOT EXISTS included_km numeric NOT NULL DEFAULT 3
  CHECK (included_km IN (2, 3));
