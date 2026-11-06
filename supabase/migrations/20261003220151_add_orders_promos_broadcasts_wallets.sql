/*
# Add orders, promo codes, and broadcasts tables

1. New Tables
- `orders` — ride requests without mandatory destination
  - id (uuid PK), customer_id (text), pickup_lat/lng (numeric), dropoff_lat/lng (nullable), status (text), created_at
- `promo_customer` — discount codes for customers
  - id (uuid PK), code (text unique), discount_percent (numeric), max_uses (int), used_count (int default 0), expiry (timestamptz), is_active (boolean)
- `promo_captain` — bonus codes for drivers
  - id (uuid PK), code (text unique), bonus_percent (numeric), max_uses (int), used_count (int default 0), expiry (timestamptz), is_active (boolean)
- `broadcasts` — admin broadcast messages
  - id (uuid PK), message (text), target (text: 'customers' | 'captains'), created_at (timestamptz)
2. Security
- All tables have RLS enabled with anon+authenticated CRUD (single-tenant public app pattern)
*/

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id text NOT NULL,
  pickup_lat numeric NOT NULL,
  pickup_lng numeric NOT NULL,
  dropoff_lat numeric,
  dropoff_lng numeric,
  status text NOT NULL DEFAULT 'pending',
  driver_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_orders" ON orders;
CREATE POLICY "anon_select_orders" ON orders FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_orders" ON orders;
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_orders" ON orders;
CREATE POLICY "anon_delete_orders" ON orders FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS promo_customer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  discount_percent numeric NOT NULL DEFAULT 10,
  max_uses int NOT NULL DEFAULT 100,
  used_count int NOT NULL DEFAULT 0,
  expiry timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE promo_customer ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_promo_customer" ON promo_customer;
CREATE POLICY "anon_select_promo_customer" ON promo_customer FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_promo_customer" ON promo_customer;
CREATE POLICY "anon_insert_promo_customer" ON promo_customer FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_promo_customer" ON promo_customer;
CREATE POLICY "anon_update_promo_customer" ON promo_customer FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_promo_customer" ON promo_customer;
CREATE POLICY "anon_delete_promo_customer" ON promo_customer FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS promo_captain (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  bonus_percent numeric NOT NULL DEFAULT 10,
  max_uses int NOT NULL DEFAULT 100,
  used_count int NOT NULL DEFAULT 0,
  expiry timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE promo_captain ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_promo_captain" ON promo_captain;
CREATE POLICY "anon_select_promo_captain" ON promo_captain FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_promo_captain" ON promo_captain;
CREATE POLICY "anon_insert_promo_captain" ON promo_captain FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_promo_captain" ON promo_captain;
CREATE POLICY "anon_update_promo_captain" ON promo_captain FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_promo_captain" ON promo_captain;
CREATE POLICY "anon_delete_promo_captain" ON promo_captain FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  target text NOT NULL DEFAULT 'customers',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_broadcasts" ON broadcasts;
CREATE POLICY "anon_select_broadcasts" ON broadcasts FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_broadcasts" ON broadcasts;
CREATE POLICY "anon_insert_broadcasts" ON broadcasts FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_broadcasts" ON broadcasts;
CREATE POLICY "anon_update_broadcasts" ON broadcasts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_broadcasts" ON broadcasts;
CREATE POLICY "anon_delete_broadcasts" ON broadcasts FOR DELETE TO anon, authenticated USING (true);
