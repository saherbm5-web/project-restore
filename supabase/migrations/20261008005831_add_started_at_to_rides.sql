/*
# Add started_at column to rides table

1. Modified Tables
- `rides`: add `started_at` (timestamptz, nullable) — records when the driver starts the trip (after arriving and picking up the passenger).
- The existing `completed_at` column already exists and records when the ride finishes.
- The existing `price` column stores the final fare.
- The existing `distance_km` column stores the trip distance.

2. Security
- No RLS changes needed — rides table already has policies.

3. Notes
- The app flow is: pending → accepted → arrived → in_progress (started) → completed
- `started_at` is set when the driver presses "الراكب صار بالسيارة" (start ride)
- `completed_at` is set when the driver presses "خلصت الرحلة" (complete ride)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rides' AND column_name = 'started_at'
  ) THEN
    ALTER TABLE rides ADD COLUMN started_at timestamptz;
  END IF;
END $$;
