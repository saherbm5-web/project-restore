/*
# Consolidate car types: sedan replaces special/yellow/electric/hybrid

## Changes
- Update car_type_options in settings to only include: sedan, family, suv, lady
- "سيدان" now covers all standard cars (special, yellow, electric, hybrid)
- Migrate existing rides and drivers with old car_type values to 'sedan'
*/

UPDATE settings
SET car_type_options = '["sedan","family","suv","lady"]'::jsonb
WHERE id = 1;

-- Migrate old car types in rides to sedan
UPDATE rides SET car_type = 'sedan' WHERE car_type IN ('special', 'yellow', 'electric', 'hybrid');

-- Migrate old car types in drivers to sedan
UPDATE drivers SET car_type = 'sedan' WHERE car_type IN ('special', 'yellow', 'electric', 'hybrid');
