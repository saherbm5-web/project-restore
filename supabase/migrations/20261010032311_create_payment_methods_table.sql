/*
# Create payment_methods table for wallet top-up options

1. New Tables
- `payment_methods`
  - `id` (serial, primary key)
  - `code` (text, unique, not null) — e.g. 'cliq', 'zain_cash', 'wallet'
  - `name` (text, not null) — display name in Arabic
  - `icon` (text) — lucide icon name or emoji placeholder
  - `is_active` (boolean, default true)
  - `sort_order` (integer, default 0)
  - `created_at` (timestamptz, default now())

2. Seed Data
- CliQ (كليك), Zain Cash (زين كاش), Wallet (محفظة)

3. Security
- RLS enabled, anon+authenticated can read (public catalog).
- No write policies needed — admin manages via SQL/settings page.
*/

CREATE TABLE IF NOT EXISTS payment_methods (
  id serial PRIMARY KEY,
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  icon text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_payment_methods" ON payment_methods;
CREATE POLICY "anon_read_payment_methods"
ON payment_methods FOR SELECT
TO anon, authenticated USING (true);

INSERT INTO payment_methods (code, name, icon, is_active, sort_order)
VALUES
  ('cliq', 'كليك - CliQ', 'smartphone', true, 1),
  ('zain_cash', 'زين كاش - Zain Cash', 'banknote', true, 2),
  ('wallet', 'محفظة - Wallet', 'wallet', true, 3)
ON CONFLICT (code) DO NOTHING;