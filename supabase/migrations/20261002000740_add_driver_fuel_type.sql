/*
# Add fuel_type column to drivers table

## Changes
- Add `fuel_type` column to `drivers` table (text, nullable)
- Stores the vehicle's fuel category: hybrid, electric, or gasoline (بنزين)
- Existing drivers get NULL (can be set later via registration or admin)
*/

ALTER TABLE drivers ADD COLUMN IF NOT EXISTS fuel_type text;
