/*
# Create promo_codes and wallet_bonus_codes tables

1. New Tables
- `promo_codes` — discount codes created by admin, applied to rides
  - `id` (uuid, primary key, default gen_random_uuid())
  - `code` (text, unique, not null) — the promo code text
  - `discount_value` (numeric, not null, default 0) — discount amount
  - `discount_type` (text, not null, default 'percent') — 'percent' or 'fixed'
  - `applicable_to` (text, not null, default 'all') — 'rider', 'driver', or 'all'
  - `max_uses` (integer, not null, default 100)
  - `used_count` (integer, not null, default 0)
  - `expiry` (timestamptz, nullable)
  - `is_active` (boolean, not null, default true)
  - `created_at` (timestamptz, default now())

- `wallet_bonus_codes` — bonus codes applied to wallet top-ups
  - `id` (uuid, primary key, default gen_random_uuid())
  - `code` (text, unique, not null)
  - `bonus_value` (numeric, not null)
  - `bonus_type` (text, default 'percent') — 'percent' or 'fixed'
  - `min_recharge` (numeric, default 0) — minimum top-up to qualify
  - `max_uses` (integer, default 100)
  - `used_count` (integer, default 0)
  - `is_active` (boolean, default true)
  - `expires_at` (timestamptz, default now() + 30 days)
  - `created_at` (timestamptz, default now())

2. Security
- RLS enabled on both tables.
- Promo/bonus codes are shared operational data managed via the admin panel;
  read, insert, update, delete are granted to anon + authenticated with
  allow-all policies matching the rest of this app's promo/payment tables.
- Explicit GRANTs for both roles in the same migration.

3. Important Notes
- Idempotent: safe to re-run (IF NOT EXISTS + DROP POLICY IF EXISTS).
- No destructive operations.
*/

CREATE TABLE IF NOT EXISTS promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  discount_value numeric NOT NULL DEFAULT 0,
  discount_type text NOT NULL DEFAULT 'percent',
  applicable_to text NOT NULL DEFAULT 'all',
  max_uses integer NOT NULL DEFAULT 100,
  used_count integer NOT NULL DEFAULT 0,
  expiry timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallet_bonus_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  bonus_value numeric NOT NULL,
  bonus_type text DEFAULT 'percent',
  min_recharge numeric DEFAULT 0,
  max_uses int DEFAULT 100,
  used_count int DEFAULT 0,
  is_active boolean DEFAULT true,
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_bonus_codes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON promo_codes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON wallet_bonus_codes TO anon, authenticated;

DROP POLICY IF EXISTS "anon_read_promo_codes" ON promo_codes;
CREATE POLICY "anon_read_promo_codes" ON promo_codes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_promo_codes" ON promo_codes;
CREATE POLICY "anon_insert_promo_codes" ON promo_codes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_promo_codes" ON promo_codes;
CREATE POLICY "anon_update_promo_codes" ON promo_codes FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_promo_codes" ON promo_codes;
CREATE POLICY "anon_delete_promo_codes" ON promo_codes FOR DELETE
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_bonus_codes" ON wallet_bonus_codes;
CREATE POLICY "anon_select_bonus_codes" ON wallet_bonus_codes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_bonus_codes" ON wallet_bonus_codes;
CREATE POLICY "anon_insert_bonus_codes" ON wallet_bonus_codes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_bonus_codes" ON wallet_bonus_codes;
CREATE POLICY "anon_update_bonus_codes" ON wallet_bonus_codes FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_bonus_codes" ON wallet_bonus_codes;
CREATE POLICY "anon_delete_bonus_codes" ON wallet_bonus_codes FOR DELETE
  TO anon, authenticated USING (true);
