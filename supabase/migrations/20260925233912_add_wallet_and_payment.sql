/*
# Add wallet system, payment methods, and top-up tracking

## Overview
Adds in-app wallet functionality and payment method tracking to the FON TAXI system.
Customers can pay rides via cash, wallet, CliQ, or IBAN transfer.
Wallet top-ups are tracked with proof-of-transfer uploads.

## Changes to existing tables

### rides (modified)
- Added `payment_method` (text: cash, wallet, cliq, iban) — defaults to 'cash'
- Added `payment_proof_url` (text, nullable) — URL to uploaded proof of transfer

## New Tables

### 1. wallets
- `id` (uuid, primary key)
- `phone` (text, unique — customer phone identifies the wallet)
- `balance` (float8, current balance in JD, defaults to 0)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### 2. wallet_topups
- `id` (uuid, primary key)
- `wallet_id` (uuid, FK to wallets)
- `phone` (text — customer phone for easy lookup)
- `amount` (float8 — top-up amount in JD)
- `method` (text: cliq, iban)
- `proof_url` (text, nullable — uploaded proof image/file URL)
- `status` (text: pending, approved, rejected — defaults to pending)
- `created_at` (timestamptz)

## Security
- RLS enabled on all new tables
- No-auth app: all policies use `TO anon, authenticated`
- All CRUD allowed for anon (shared/public data model)
- Realtime enabled on wallets and wallet_topups for live balance updates
*/

-- Add payment_method and payment_proof_url to rides
ALTER TABLE rides ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'wallet', 'cliq', 'iban'));
ALTER TABLE rides ADD COLUMN IF NOT EXISTS payment_proof_url text;

-- Create wallets table
CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text UNIQUE NOT NULL,
  balance float8 NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create wallet_topups table
CREATE TABLE IF NOT EXISTS wallet_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid REFERENCES wallets(id) ON DELETE CASCADE,
  phone text NOT NULL,
  amount float8 NOT NULL CHECK (amount > 0),
  method text NOT NULL CHECK (method IN ('cliq', 'iban')),
  proof_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_topups ENABLE ROW LEVEL SECURITY;

-- Wallets policies
DROP POLICY IF EXISTS "anon_select_wallets" ON wallets;
CREATE POLICY "anon_select_wallets" ON wallets FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_wallets" ON wallets;
CREATE POLICY "anon_insert_wallets" ON wallets FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_wallets" ON wallets;
CREATE POLICY "anon_update_wallets" ON wallets FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_wallets" ON wallets;
CREATE POLICY "anon_delete_wallets" ON wallets FOR DELETE
  TO anon, authenticated USING (true);

-- Wallet topups policies
DROP POLICY IF EXISTS "anon_select_wallet_topups" ON wallet_topups;
CREATE POLICY "anon_select_wallet_topups" ON wallet_topups FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_wallet_topups" ON wallet_topups;
CREATE POLICY "anon_insert_wallet_topups" ON wallet_topups FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_wallet_topups" ON wallet_topups;
CREATE POLICY "anon_update_wallet_topups" ON wallet_topups FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_wallet_topups" ON wallet_topups;
CREATE POLICY "anon_delete_wallet_topups" ON wallet_topups FOR DELETE
  TO anon, authenticated USING (true);

-- Enable Realtime on wallets for live balance updates
ALTER PUBLICATION supabase_realtime ADD TABLE wallets;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_wallets_phone ON wallets (phone);
CREATE INDEX IF NOT EXISTS idx_wallet_topups_phone ON wallet_topups (phone);
CREATE INDEX IF NOT EXISTS idx_wallet_topups_status ON wallet_topups (status);
