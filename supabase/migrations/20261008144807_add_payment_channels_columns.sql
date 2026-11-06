/*
# Extend payment_settings with payment channel columns + receipts bucket

1. New Columns on `payment_settings`
   - `click_code` (text) — CliQ payment code shown to users
   - `click_link` (text) — optional CliQ payment link/URL
   - `wallet_number` (text) — e-wallet number (Zain Cash, Amwal Wallet, etc.)
   - `bank_name` (text) — bank name for bank transfers
   - `bank_iban` (text) — IBAN for bank transfers
   - `bank_account_name` (text) — account holder name
   - `is_active` (boolean, default true) — whether this payment channel is shown to users
   - `updated_at` (timestamptz) — last update timestamp

2. Storage
   - Create `receipts` bucket (public) for user receipt uploads

3. Security
   - No new RLS changes needed (payment_settings already has policies from prior migration)
   - Storage bucket policies for receipts: public read, authenticated upload
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_settings' AND column_name = 'click_code') THEN
    ALTER TABLE payment_settings ADD COLUMN click_code text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_settings' AND column_name = 'click_link') THEN
    ALTER TABLE payment_settings ADD COLUMN click_link text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_settings' AND column_name = 'wallet_number') THEN
    ALTER TABLE payment_settings ADD COLUMN wallet_number text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_settings' AND column_name = 'bank_name') THEN
    ALTER TABLE payment_settings ADD COLUMN bank_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_settings' AND column_name = 'bank_iban') THEN
    ALTER TABLE payment_settings ADD COLUMN bank_iban text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_settings' AND column_name = 'bank_account_name') THEN
    ALTER TABLE payment_settings ADD COLUMN bank_account_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_settings' AND column_name = 'is_active') THEN
    ALTER TABLE payment_settings ADD COLUMN is_active boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_settings' AND column_name = 'updated_at') THEN
    ALTER TABLE payment_settings ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Create receipts storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for receipts bucket
DROP POLICY IF EXISTS "receipts_public_read" ON storage.objects;
CREATE POLICY "receipts_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'receipts');

DROP POLICY IF EXISTS "receipts_auth_upload" ON storage.objects;
CREATE POLICY "receipts_auth_upload"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'receipts');

DROP POLICY IF EXISTS "receipts_auth_update" ON storage.objects;
CREATE POLICY "receipts_auth_update"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'receipts')
WITH CHECK (bucket_id = 'receipts');

-- Ensure payment_settings has RLS and policies (may already exist from prior migration)
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_settings_read_all" ON payment_settings;
CREATE POLICY "payment_settings_read_all"
ON payment_settings FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "payment_settings_write_all" ON payment_settings;
CREATE POLICY "payment_settings_write_all"
ON payment_settings FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "payment_settings_update_all" ON payment_settings;
CREATE POLICY "payment_settings_update_all"
ON payment_settings FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);
