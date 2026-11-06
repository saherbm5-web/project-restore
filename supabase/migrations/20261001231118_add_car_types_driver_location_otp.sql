/*
# Add car types, driver location tracking, and OTP verification

## Changes

### 1. Car types
- Add `car_type` column to `rides` table (text, nullable) — stores the customer's chosen car type
- Add `car_type_options` column to `settings` table (jsonb, default array of available types)
- Car types: 'special' (خاصة), 'yellow' (أصفر), 'electric' (كهربائية), 'family' (عائلية), 'suv' (جيب), 'lady' (كابتن ليدي)

### 2. Driver location tracking
- Add `current_lat` (double precision, nullable) to `drivers` — live latitude
- Add `current_lng` (double precision, nullable) to `drivers` — live longitude
- Add `location_updated_at` (timestamptz, nullable) to `drivers` — when location was last updated

### 3. OTP verification
- New table `otp_codes` for storing verification codes
- `id` (uuid, primary key)
- `phone` (text, not null) — phone number being verified
- `code` (text, not null) — 4-digit OTP code
- `expires_at` (timestamptz, not null) — code expiry (5 minutes)
- `used` (boolean, default false) — whether code was used
- `created_at` (timestamptz, default now())

### 4. Security
- Enable RLS on `otp_codes`
- Allow anon/authenticated to insert (for requesting OTP) and select (for verifying)
- OTP codes are ephemeral and not sensitive beyond their 5-minute window

### Notes
- This is a no-auth app (no sign-in screen for customers), so policies use `TO anon, authenticated`
- Driver location updates come from the driver app which also uses anon key
*/

-- Add car_type to rides
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rides' AND column_name = 'car_type') THEN
    ALTER TABLE rides ADD COLUMN car_type text;
  END IF;
END $$;

-- Add car_type_options to settings
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'car_type_options') THEN
    ALTER TABLE settings ADD COLUMN car_type_options jsonb DEFAULT '["special","yellow","electric","family","suv","lady"]'::jsonb;
  END IF;
END $$;

-- Add driver location columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'current_lat') THEN
    ALTER TABLE drivers ADD COLUMN current_lat double precision;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'current_lng') THEN
    ALTER TABLE drivers ADD COLUMN current_lng double precision;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'location_updated_at') THEN
    ALTER TABLE drivers ADD COLUMN location_updated_at timestamptz;
  END IF;
END $$;

-- Create OTP codes table
CREATE TABLE IF NOT EXISTS otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_otp" ON otp_codes;
CREATE POLICY "anon_select_otp" ON otp_codes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_otp" ON otp_codes;
CREATE POLICY "anon_insert_otp" ON otp_codes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_otp" ON otp_codes;
CREATE POLICY "anon_update_otp" ON otp_codes FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_otp" ON otp_codes;
CREATE POLICY "anon_delete_otp" ON otp_codes FOR DELETE
  TO anon, authenticated USING (true);

-- Index for looking up OTP by phone
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at);

-- Add policy for reading driver locations (needed for showing nearby cars)
-- Already exists as anon_select_drivers with USING (true), so no change needed
-- Add policy for updating driver location
-- Already exists as anon_update_drivers with USING (true) WITH CHECK (true)
