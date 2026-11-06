/*
# Expand payment_methods table for wallet top-up channels

## Overview
The `payment_methods` table previously stored only a code/name/icon for display.
The admin needs to manage 3 payment channels (IBAN, CliQ, Zain Cash) each with
their own account number, account name, bank name, and payment instructions.
Users (riders and drivers) need to see all active methods as selectable cards
and upload a receipt screenshot after transfer.

## Changes

### 1. New columns on `payment_methods`
- `type` (text, NOT NULL, default 'iban') — one of: 'iban', 'cliq', 'zain_cash'
- `account_number` (text) — the IBAN / CliQ alias / Zain Cash wallet number
- `account_name` (text) — the account holder display name
- `bank_name` (text) — bank name (for IBAN type, nullable for others)
- `instructions` (text) — payment instructions shown to the user after selection

### 2. Seed data
Insert one row per type (iban, cliq, zain_cash) with placeholder account info
so the admin can fill in real details from the settings page.

### 3. RLS policies
- Public read stays (anon + authenticated SELECT).
- Add INSERT/UPDATE/DELETE policies for anon + authenticated so the admin
  panel (which uses the anon key) can manage rows.

### 4. Storage bucket
- Create `receipts` bucket (public read) for upload of transfer receipt photos.
- Policies: anyone can upload, anyone can read (public catalog bucket).

## Notes
- The old `code` column stays for backward compatibility with wallet_transactions.
- `is_active` and `sort_order` are unchanged.
- Multiple rows of the same `type` are allowed (admin can add more than one IBAN).
*/

-- 1. Add new columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_methods' AND column_name = 'type') THEN
    ALTER TABLE payment_methods ADD COLUMN type text NOT NULL DEFAULT 'iban';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_methods' AND column_name = 'account_number') THEN
    ALTER TABLE payment_methods ADD COLUMN account_number text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_methods' AND column_name = 'account_name') THEN
    ALTER TABLE payment_methods ADD COLUMN account_name text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_methods' AND column_name = 'bank_name') THEN
    ALTER TABLE payment_methods ADD COLUMN bank_name text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_methods' AND column_name = 'instructions') THEN
    ALTER TABLE payment_methods ADD COLUMN instructions text;
  END IF;
END $$;

-- 2. Update existing seed rows with type + placeholder account info
UPDATE payment_methods SET type = 'cliq', account_number = '', account_name = '', instructions = 'حوّل المبلغ على رقم كليك المذكور، ثم ارفع صورة الإيصال' WHERE code = 'cliq';
UPDATE payment_methods SET type = 'zain_cash', account_number = '', account_name = '', instructions = 'حوّل المبلغ على محفظة زين كاش المذكورة، ثم ارفع صورة الإيصال' WHERE code = 'zain_cash';

-- Insert IBAN row if not exists
INSERT INTO payment_methods (code, name, icon, is_active, sort_order, type, account_number, account_name, bank_name, instructions)
VALUES ('iban', 'آيبان - IBAN', 'credit-card', true, 0, 'iban', '', '', '', 'حوّل المبلغ على رقم الـ IBAN المذكور، ثم ارفع صورة الإيصال')
ON CONFLICT (code) DO UPDATE SET
  type = EXCLUDED.type,
  instructions = EXCLUDED.instructions,
  icon = EXCLUDED.icon,
  name = EXCLUDED.name;

-- Update wallet row
UPDATE payment_methods SET type = 'wallet', instructions = 'الدفع من رصيد المحفظة مباشرة' WHERE code = 'wallet';

-- 3. RLS write policies for admin management
DROP POLICY IF EXISTS "anon_insert_payment_methods" ON payment_methods;
CREATE POLICY "anon_insert_payment_methods"
ON payment_methods FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_payment_methods" ON payment_methods;
CREATE POLICY "anon_update_payment_methods"
ON payment_methods FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_payment_methods" ON payment_methods;
CREATE POLICY "anon_delete_payment_methods"
ON payment_methods FOR DELETE
TO anon, authenticated USING (true);

-- 4. Storage bucket for receipt uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anon_upload_receipts" ON storage.objects;
CREATE POLICY "anon_upload_receipts"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'receipts');

DROP POLICY IF EXISTS "anon_read_receipts" ON storage.objects;
CREATE POLICY "anon_read_receipts"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'receipts');

DROP POLICY IF EXISTS "anon_delete_receipts" ON storage.objects;
CREATE POLICY "anon_delete_receipts"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'receipts');
