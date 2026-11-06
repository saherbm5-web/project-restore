/*
# Add proof_url column to wallet_transactions

1. Modified Tables
- `wallet_transactions`: added `proof_url` (text, nullable) to store the URL of a proof-of-transfer image uploaded by users during wallet top-up requests.
2. Security
- No policy changes needed; existing policies already cover the table.
*/

ALTER TABLE wallet_transactions
ADD COLUMN IF NOT EXISTS proof_url text;
