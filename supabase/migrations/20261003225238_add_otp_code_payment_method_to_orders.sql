-- Add otp_code and payment_method to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS otp_code text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'cash';

-- Add status column to wallet_transactions for pending top-up tracking
ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS status text DEFAULT 'approved';
ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS method text;
