/*
# Add click_name column to payment_settings

1. Modified Tables
- `payment_settings`: add `click_name` (text, nullable) — display name for the Click payment option
*/

ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS click_name text;