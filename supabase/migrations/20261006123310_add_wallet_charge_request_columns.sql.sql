/*
# Add charge request detail columns to wallet_transactions

1. Purpose
   When a passenger or driver requests a wallet top-up, we now capture:
   - which payment method they used (cliq / wallet / bank)
   - their own source account (CliQ alias, wallet number, or IBAN they transferred FROM)
   - the company destination account (read-only, copied from payment_settings at request time)
   - the user's role (passenger / driver) so the admin can identify who requested the charge

2. New Columns (all nullable — existing rows are unaffected)
   - source_account     text  — the account the user transferred from
   - company_account    text  — the company account they transferred to (snapshot from settings)
   - user_role          text  — 'passenger' or 'driver'

3. Security
   No new tables. RLS already enabled on wallet_transactions with anon+authenticated CRUD.
   No policy changes needed — the new columns are populated by the same insert path.
*/

ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS source_account text,
  ADD COLUMN IF NOT EXISTS company_account text,
  ADD COLUMN IF NOT EXISTS user_role text;
