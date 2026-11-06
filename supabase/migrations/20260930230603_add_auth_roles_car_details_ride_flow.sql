/*
# Add auth roles, car details, and ride flow statuses

## Overview
Adds role-based auth support, car details for drivers, and expanded ride statuses for the full ride flow.

## Changes to existing tables

### profiles (modified)
- `email` (text, nullable) — links to auth.users email
- `role` (text, default 'customer') — role: customer, driver, admin
- `user_id` (uuid, nullable, FK to auth.users) — links profile to auth account

### drivers (modified)
- `car_type` (text) — sedan, SUV, van, luxury
- `car_model` (text) — e.g. Toyota Camry 2022
- `car_color` (text) — white, black, silver, gold, etc.
- `license_number` (text) — driver license number

### rides (modified)
- Status constraint expanded to include 'arrived' and 'in_progress'
*/

-- Add columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'driver', 'admin'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add car details to drivers
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS car_type text;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS car_model text;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS car_color text;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS license_number text;

-- Expand rides status to include arrived and in_progress
ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_status_check;
ALTER TABLE rides ADD CONSTRAINT rides_status_check CHECK (status IN ('pending', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled'));