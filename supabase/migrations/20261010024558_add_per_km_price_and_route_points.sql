-- Add per_km_price to drivers for per-driver pricing
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS per_km_price double precision DEFAULT 0.5;

-- Add route_points JSONB column to rides for storing the trip path
ALTER TABLE rides ADD COLUMN IF NOT EXISTS route_points jsonb DEFAULT '[]'::jsonb;

-- Add final_price column to rides (distinct from estimated price)
ALTER TABLE rides ADD COLUMN IF NOT EXISTS final_price double precision;