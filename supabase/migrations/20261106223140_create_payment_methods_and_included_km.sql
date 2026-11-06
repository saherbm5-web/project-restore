/*
# Create payment_methods table and add included_km to pricing_settings

1. New Tables
- `payment_methods`: the payment channels offered for wallet top-ups and ride payments.
  Columns: id (serial, primary key), code (unique), name, icon, type (iban, cliq, zain_cash, wallet),
  account_number, account_name, bank_name, instructions, is_active, sort_order, created_at.
- Seeded with the default channels: IBAN, CliQ, Zain Cash, and Wallet.

2. Modified Tables
- `pricing_settings`: adds `included_km` (2 or 3 km included in the base fare, default 3).

3. Security
- RLS enabled on `payment_methods`.
- Grants SELECT, INSERT, UPDATE, DELETE to anon and authenticated, because the admin panel uses the anon key.
- Public read policy plus insert, update, and delete policies for anon and authenticated.

4. Important Notes
- Every statement is idempotent, so the migration is safe to re-run.
- No existing rows are dropped or changed beyond the seed rows that are inserted when missing.
*/

CREATE TABLE IF NOT EXISTS payment_methods (
  id serial PRIMARY KEY,
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  icon text,
  type text NOT NULL DEFAULT 'iban',
  account_number text,
  account_name text,
  bank_name text,
  instructions text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON payment_methods TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE payment_methods_id_seq TO anon, authenticated;

DROP POLICY IF EXISTS "anon_read_payment_methods" ON payment_methods;
CREATE POLICY "anon_read_payment_methods" ON payment_methods FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_payment_methods" ON payment_methods;
CREATE POLICY "anon_insert_payment_methods" ON payment_methods FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_payment_methods" ON payment_methods;
CREATE POLICY "anon_update_payment_methods" ON payment_methods FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_payment_methods" ON payment_methods;
CREATE POLICY "anon_delete_payment_methods" ON payment_methods FOR DELETE
TO anon, authenticated USING (true);

INSERT INTO payment_methods (code, name, icon, type, account_number, account_name, bank_name, instructions, is_active, sort_order)
VALUES
  ('iban', 'آيبان - IBAN', 'credit-card', 'iban', '', '', '', 'حوّل المبلغ على رقم الـ IBAN المذكور، ثم ارفع صورة الإيصال', true, 0),
  ('cliq', 'كليك - CliQ', 'smartphone', 'cliq', '', '', '', 'حوّل المبلغ على رقم كليك المذكور، ثم ارفع صورة الإيصال', true, 1),
  ('zain_cash', 'زين كاش - Zain Cash', 'banknote', 'zain_cash', '', '', '', 'حوّل المبلغ على محفظة زين كاش المذكورة، ثم ارفع صورة الإيصال', true, 2),
  ('wallet', 'محفظة - Wallet', 'wallet', 'wallet', '', '', '', 'الدفع من رصيد المحفظة مباشرة', true, 3)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE pricing_settings
  ADD COLUMN IF NOT EXISTS included_km numeric NOT NULL DEFAULT 3
  CHECK (included_km IN (2, 3));
