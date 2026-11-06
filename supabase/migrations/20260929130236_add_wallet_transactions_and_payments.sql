/*
# Add wallet_transactions and payments tables

## Overview
Adds two new tables to fully connect the FON TAXI app to Supabase for all financial data.
- `wallet_transactions` tracks every wallet credit/debit movement.
- `payments` records a payment for each completed ride.

## New Tables

### 1. wallet_transactions
- `id` (uuid, primary key)
- `wallet_id` (uuid, FK to wallets, nullable)
- `phone` (text — customer phone for easy lookup)
- `amount` (float8 — positive for credit, negative for debit)
- `type` (text: topup, ride_payment, admin_adjust)
- `reference` (text, nullable — ride id or topup id)
- `created_at` (timestamptz)

### 2. payments
- `id` (uuid, primary key)
- `ride_id` (uuid, FK to rides)
- `phone` (text — customer phone)
- `amount` (float8 — payment amount in JD)
- `method` (text: cash, wallet, cliq, iban)
- `status` (text: pending, paid)
- `created_at` (timestamptz)

## Security
- RLS enabled on both new tables.
- No-auth app: all policies use `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)`.
- Realtime enabled on wallet_transactions and payments.
*/

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL,
  phone text NOT NULL,
  amount float8 NOT NULL,
  type text NOT NULL CHECK (type IN ('topup', 'ride_payment', 'admin_adjust')),
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid REFERENCES rides(id) ON DELETE CASCADE,
  phone text NOT NULL,
  amount float8 NOT NULL,
  method text NOT NULL CHECK (method IN ('cash', 'wallet', 'cliq', 'iban')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- wallet_transactions policies
DROP POLICY IF EXISTS "anon_select_wallet_transactions" ON wallet_transactions;
CREATE POLICY "anon_select_wallet_transactions" ON wallet_transactions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_wallet_transactions" ON wallet_transactions;
CREATE POLICY "anon_insert_wallet_transactions" ON wallet_transactions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_wallet_transactions" ON wallet_transactions;
CREATE POLICY "anon_update_wallet_transactions" ON wallet_transactions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_wallet_transactions" ON wallet_transactions;
CREATE POLICY "anon_delete_wallet_transactions" ON wallet_transactions FOR DELETE
  TO anon, authenticated USING (true);

-- payments policies
DROP POLICY IF EXISTS "anon_select_payments" ON payments;
CREATE POLICY "anon_select_payments" ON payments FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_payments" ON payments;
CREATE POLICY "anon_insert_payments" ON payments FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_payments" ON payments;
CREATE POLICY "anon_update_payments" ON payments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_payments" ON payments;
CREATE POLICY "anon_delete_payments" ON payments FOR DELETE
  TO anon, authenticated USING (true);

-- Realtime (wallets and wallet_topups already added in previous migration)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE wallet_transactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE payments;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_phone ON wallet_transactions (phone);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions (wallet_id);
CREATE INDEX IF NOT EXISTS idx_payments_ride_id ON payments (ride_id);
CREATE INDEX IF NOT EXISTS idx_payments_phone ON payments (phone);