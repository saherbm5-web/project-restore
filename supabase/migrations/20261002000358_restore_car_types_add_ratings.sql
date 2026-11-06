/*
# Restore individual car types and create driver_ratings table

## Changes

### Car Types
- Update settings car_type_options to: special, yellow, electric, hybrid, family, suv, lady
- "سيدان" removed; replaced with the 4 individual types it was consolidating
- Migrate existing rides/drivers with car_type='sedan' back to 'special' (most common default)

### New Table: driver_ratings
- Stores customer ratings for drivers after ride completion
- `id` (uuid, primary key)
- `driver_id` (uuid, references drivers)
- `ride_id` (uuid, references rides)
- `customer_phone` (text)
- `rating` (integer 1-5)
- `comment` (text, nullable)
- `created_at` (timestamp)

### Security
- RLS enabled on driver_ratings
- anon + authenticated can insert ratings (no auth screen for customers)
- anon + authenticated can read ratings
- No update/delete needed (ratings are immutable)
*/

UPDATE settings
SET car_type_options = '["special","yellow","electric","hybrid","family","suv","lady"]'::jsonb
WHERE id = 1;

-- Migrate sedan back to special
UPDATE rides SET car_type = 'special' WHERE car_type = 'sedan';
UPDATE drivers SET car_type = 'special' WHERE car_type = 'sedan';

-- Create driver_ratings table
CREATE TABLE IF NOT EXISTS driver_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES drivers(id) ON DELETE CASCADE,
  ride_id uuid REFERENCES rides(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE driver_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ratings" ON driver_ratings;
CREATE POLICY "anon_select_ratings" ON driver_ratings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_ratings" ON driver_ratings;
CREATE POLICY "anon_insert_ratings" ON driver_ratings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- Index for querying ratings by driver
CREATE INDEX IF NOT EXISTS idx_driver_ratings_driver_id ON driver_ratings(driver_id);
