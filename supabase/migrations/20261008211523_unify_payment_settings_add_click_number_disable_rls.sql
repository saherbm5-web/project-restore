-- Add click_number column to payment_settings
ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS click_number text;

-- Disable RLS so the anon key client can read/write
ALTER TABLE payment_settings DISABLE ROW LEVEL SECURITY;

-- Ensure id=1 row exists (it does, but safeguard)
INSERT INTO payment_settings (id, bank_name, bank_iban, bank_account_name, wallet_number, is_active)
VALUES (1, 'JO BANK', 'JO16AM287665456876FG8', 'S.B.M', '0775908888', true)
ON CONFLICT (id) DO NOTHING;
