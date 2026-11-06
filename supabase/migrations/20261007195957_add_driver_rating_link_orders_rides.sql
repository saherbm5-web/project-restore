/*
# Add driver rating/total_rides, link rides to orders, ensure orders RLS

1. New Columns
- `drivers.rating` (double precision, default 5.0) — driver's average rating
- `drivers.total_rides` (integer, default 0) — total completed rides count
- `rides.order_id` (uuid, nullable) — links a ride to the customer's order
- `rides.from_lat`, `rides.from_lng` — already exist but may be nullable; ensure they work
- `orders.driver_id` — already text nullable, keep as-is

2. Modified Tables
- `drivers`: added rating and total_rides columns
- `rides`: added order_id column with FK to orders(id) ON DELETE SET NULL

3. Security
- Ensure RLS is enabled on orders (already enabled from prior migration)
- Add missing policies on orders if needed: anon/authenticated can CRUD
  since this is a phone-based app without Supabase auth user_id linkage

4. Important Notes
- The app uses phone-based identification (localStorage + OTP), not Supabase auth user_id
- Orders are keyed by customer_id (phone text), not auth.uid()
- All policies use anon + authenticated since the frontend runs with anon key
*/

-- Add rating and total_rides to drivers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'rating') THEN
    ALTER TABLE drivers ADD COLUMN rating double precision NOT NULL DEFAULT 5.0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drivers' AND column_name = 'total_rides') THEN
    ALTER TABLE drivers ADD COLUMN total_rides integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add order_id to rides to link with orders table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rides' AND column_name = 'order_id') THEN
    ALTER TABLE rides ADD COLUMN order_id uuid REFERENCES orders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Ensure orders has RLS enabled
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE tablename = 'orders' AND rowsecurity = true
  ) THEN
    ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Orders policies (anon + authenticated since phone-based, no auth.uid)
DROP POLICY IF EXISTS "anon_select_orders" ON orders;
CREATE POLICY "anon_select_orders" ON orders FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_orders" ON orders;
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_orders" ON orders;
CREATE POLICY "anon_delete_orders" ON orders FOR DELETE
TO anon, authenticated USING (true);

-- Rides policies: ensure they exist (may already be there)
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

-- Drivers policies: ensure anon can read and update (for location updates)
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
