/*
# FON TAXI - Create core tables for luxury taxi system

## Overview
Creates the database schema for a complete taxi system serving Jordan with three linked apps:
- Customer app (request rides)
- Driver app (accept/reject rides)
- Admin panel (dashboard, monitoring, settings)

## New Tables

### 1. rides
- `id` (uuid, primary key)
- `customer_phone` (text, customer contact number)
- `from_address` (text, pickup location address)
- `to_address` (text, destination address)
- `from_lat` (float8, pickup latitude)
- `from_lng` (float8, pickup longitude)
- `to_lat` (float8, destination latitude)
- `to_lng` (float8, destination longitude)
- `distance_km` (float8, trip distance in kilometers)
- `price` (float8, calculated fare in JD)
- `status` (text enum: pending, accepted, completed, cancelled)
- `driver_id` (uuid, nullable, assigned driver)
- `accuracy_type` (text: gps, ip, manual)
- `created_at` (timestamptz)
- `accepted_at` (timestamptz, nullable)
- `completed_at` (timestamptz, nullable)

### 2. drivers
- `id` (uuid, primary key)
- `name` (text, driver name)
- `phone` (text, driver phone)
- `car_number` (text, vehicle plate number)
- `is_online` (boolean, online status)
- `created_at` (timestamptz)

### 3. settings
- `id` (int, primary key, always 1)
- `opening_day` (float8, daytime meter opening price JD)
- `opening_night` (float8, nighttime meter opening price JD)
- `km_price_day` (float8, daytime per-km price JD)
- `km_price_night` (float8, nighttime per-km price JD)
- `wait_price_per_min` (float8, waiting price per minute JD)
- `night_start_hour` (int, hour night pricing starts)
- `night_end_hour` (int, hour night pricing ends)

## Security
- RLS enabled on all tables
- This is a no-auth app (no sign-in screen) — all policies use `TO anon, authenticated`
- All CRUD operations allowed for anon (shared/public data model for a taxi dispatch system)

## Realtime
- Realtime enabled on rides table for live dispatch
- Realtime enabled on drivers table for online status tracking
*/

-- Create rides table
CREATE TABLE IF NOT EXISTS rides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone text NOT NULL,
  from_address text NOT NULL,
  to_address text NOT NULL,
  from_lat float8,
  from_lng float8,
  to_lat float8,
  to_lng float8,
  distance_km float8,
  price float8,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'cancelled')),
  driver_id uuid,
  accuracy_type text DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  completed_at timestamptz
);

-- Create drivers table
CREATE TABLE IF NOT EXISTS drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  car_number text NOT NULL,
  is_online boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create settings table (single-row)
CREATE TABLE IF NOT EXISTS settings (
  id int PRIMARY KEY DEFAULT 1,
  opening_day float8 NOT NULL DEFAULT 0.39,
  opening_night float8 NOT NULL DEFAULT 0.40,
  km_price_day float8 NOT NULL DEFAULT 0.28,
  km_price_night float8 NOT NULL DEFAULT 0.33,
  wait_price_per_min float8 NOT NULL DEFAULT 0.05,
  night_start_hour int NOT NULL DEFAULT 22,
  night_end_hour int NOT NULL DEFAULT 6
);

-- Insert default settings row if not exists
INSERT INTO settings (id)
SELECT 1
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE id = 1);

-- Enable RLS on all tables
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Rides policies (no-auth app: anon + authenticated)
DROP POLICY IF EXISTS "anon_select_rides" ON rides;
CREATE POLICY "anon_select_rides" ON rides FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_rides" ON rides;
CREATE POLICY "anon_insert_rides" ON rides FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_rides" ON rides;
CREATE POLICY "anon_update_rides" ON rides FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_rides" ON rides;
CREATE POLICY "anon_delete_rides" ON rides FOR DELETE
  TO anon, authenticated USING (true);

-- Drivers policies
DROP POLICY IF EXISTS "anon_select_drivers" ON drivers;
CREATE POLICY "anon_select_drivers" ON drivers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_drivers" ON drivers;
CREATE POLICY "anon_insert_drivers" ON drivers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_drivers" ON drivers;
CREATE POLICY "anon_update_drivers" ON drivers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_drivers" ON drivers;
CREATE POLICY "anon_delete_drivers" ON drivers FOR DELETE
  TO anon, authenticated USING (true);

-- Settings policies
DROP POLICY IF EXISTS "anon_select_settings" ON settings;
CREATE POLICY "anon_select_settings" ON settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_update_settings" ON settings;
CREATE POLICY "anon_update_settings" ON settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Enable Realtime on rides and drivers tables
ALTER PUBLICATION supabase_realtime ADD TABLE rides;
ALTER PUBLICATION supabase_realtime ADD TABLE drivers;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides (status);
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON rides (driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_created_at ON rides (created_at DESC);
