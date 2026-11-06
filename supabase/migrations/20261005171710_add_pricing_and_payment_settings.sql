/*
# Add pricing_settings and payment_settings tables

1. New Tables
- `pricing_settings`: stores per-car-type pricing (opening, km price day/night, wait price per min) + night hours. Single row (id=1).
  - id (int, pk, default 1)
  - night_start_hour (int, default 22)
  - night_end_hour (int, default 6)
  - wait_price_per_min (numeric, default 0.05)
  - car_pricing (jsonb, keyed by car type: { opening, km_price_day, km_price_night })
  - updated_at (timestamptz)
- `payment_settings`: stores company payment info (CliQ alias, wallet number, IBAN, bank name). Single row (id=1).
  - id (int, pk, default 1)
  - cliq_alias (text)
  - wallet_number (text)
  - iban (text)
  - bank_name (text)
  - account_name (text)
  - updated_at (timestamptz)
2. Security
- Enable RLS on both tables.
- Allow anon + authenticated CRUD (admin app has no auth gate on these tables).
3. Notes
- Both tables use a single-row pattern (id=1). Upsert on save.
*/

CREATE TABLE IF NOT EXISTS pricing_settings (
  id int PRIMARY KEY DEFAULT 1,
  night_start_hour int NOT NULL DEFAULT 22,
  night_end_hour int NOT NULL DEFAULT 6,
  wait_price_per_min numeric NOT NULL DEFAULT 0.05,
  car_pricing jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pricing_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_pricing_settings" ON pricing_settings;
CREATE POLICY "anon_select_pricing_settings" ON pricing_settings FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_pricing_settings" ON pricing_settings;
CREATE POLICY "anon_insert_pricing_settings" ON pricing_settings FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_pricing_settings" ON pricing_settings;
CREATE POLICY "anon_update_pricing_settings" ON pricing_settings FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS payment_settings (
  id int PRIMARY KEY DEFAULT 1,
  cliq_alias text NOT NULL DEFAULT '0775908989',
  wallet_number text NOT NULL DEFAULT '0775908989',
  iban text NOT NULL DEFAULT 'JO16JIBA101000206357751040000',
  bank_name text NOT NULL DEFAULT '',
  account_name text NOT NULL DEFAULT 'ساهر ملحم',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_payment_settings" ON payment_settings;
CREATE POLICY "anon_select_payment_settings" ON payment_settings FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_payment_settings" ON payment_settings;
CREATE POLICY "anon_insert_payment_settings" ON payment_settings FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_payment_settings" ON payment_settings;
CREATE POLICY "anon_update_payment_settings" ON payment_settings FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

-- Seed default car pricing
INSERT INTO pricing_settings (id, car_pricing)
VALUES (1, jsonb_build_object(
  'electric', jsonb_build_object('opening', 1.0, 'km_price_day', 0.28, 'km_price_night', 0.33),
  'hybrid', jsonb_build_object('opening', 1.0, 'km_price_day', 0.30, 'km_price_night', 0.35),
  'petrol', jsonb_build_object('opening', 1.0, 'km_price_day', 0.28, 'km_price_night', 0.33),
  'premium', jsonb_build_object('opening', 1.5, 'km_price_day', 0.40, 'km_price_night', 0.45),
  'lady', jsonb_build_object('opening', 1.0, 'km_price_day', 0.28, 'km_price_night', 0.33),
  'family', jsonb_build_object('opening', 1.0, 'km_price_day', 0.35, 'km_price_night', 0.40)
))
ON CONFLICT (id) DO NOTHING;

INSERT INTO payment_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;
