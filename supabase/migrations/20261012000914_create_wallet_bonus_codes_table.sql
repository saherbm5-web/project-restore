/*
# Create wallet_bonus_codes table

1. New Tables
- `wallet_bonus_codes` — stores bonus codes for wallet top-ups
  - `id` (uuid, primary key)
  - `code` (text, unique) — 6-character alphanumeric bonus code
  - `bonus_value` (numeric) — percentage or fixed bonus amount
  - `bonus_type` (text, default 'percent') — 'percent' or 'fixed'
  - `min_recharge` (numeric, default 0) — minimum top-up to qualify
  - `max_uses` (int, default 100) — max times the code can be used
  - `used_count` (int, default 0) — how many times it's been used
  - `is_active` (boolean, default true)
  - `expires_at` (timestamptz, default 30 days from creation)
  - `created_at` (timestamptz, default now())

2. Security
- RLS enabled with public read/write (anon + authenticated) — the admin manages codes,
  riders/drivers read and validate them. No ownership scoping needed since this is
  shared promotional data.
*/

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

ALTER TABLE wallet_bonus_codes ENABLE ROW LEVEL SECURITY;

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