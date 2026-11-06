-- Add image URL columns and extra registration fields to drivers
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS vehicle_license_url text;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS driver_with_car_url text;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS selfie_url text;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS national_id text;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS car_year text;
