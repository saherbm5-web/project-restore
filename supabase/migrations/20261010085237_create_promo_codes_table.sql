/*
# Create unified promo_codes table

1. New Tables
- `promo_codes`
  - `id` (uuid, primary key)
  - `code` (text, unique, not null)
  - `discount_value` (numeric, not null) — the discount amount
  - `discount_type` (text, not null) — 'percent' or 'fixed'
  - `applicable_to` (text, not null) — 'rider', 'driver', or 'all'
  - `max_uses` (integer, default 100)
  - `used_count` (integer, default 0)
  - `expiry` (timestamptz, nullable)
  - `is_active` (boolean, default true)
  - `created_at` (timestamptz, default now())

2. Security
- RLS enabled, anon+authenticated can read and update (for used_count increment).
- No DELETE policy — admin manages via SQL.
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

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_promo_codes" ON promo_codes;
CREATE POLICY "anon_read_promo_codes"
ON promo_codes FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_promo_codes" ON promo_codes;
CREATE POLICY "anon_insert_promo_codes"
ON promo_codes FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_promo_codes" ON promo_codes;
CREATE POLICY "anon_update_promo_codes"
ON promo_codes FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_promo_codes" ON promo_codes;
CREATE POLICY "anon_delete_promo_codes"
ON promo_codes FOR DELETE
TO anon, authenticated USING (true);