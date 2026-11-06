/*
# Create profiles table for user accounts (no-auth, phone-based)

1. New Tables
- `profiles`
  - `id` (uuid, primary key)
  - `phone` (text, unique, not null) — the user's phone number is the identifier
  - `name` (text, nullable) — display name
  - `avatar_url` (text, nullable) — profile photo URL
  - `rating` (real, default 5.0) — user rating
  - `total_rides` (integer, default 0) — ride count
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

2. Security
- Enable RLS on `profiles`.
- Allow anon + authenticated full CRUD since this is a no-auth app keyed by phone.
- The data is intentionally public/shared (no sign-in screen).

3. Notes
- Phone number acts as the user identifier (no auth system).
- `total_rides` is maintained by the app after each completed ride.
- `rating` defaults to 5.0 and can be updated by the driver after a ride.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text UNIQUE NOT NULL,
  name text,
  avatar_url text,
  rating real NOT NULL DEFAULT 5.0,
  total_rides integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_profiles" ON profiles;
CREATE POLICY "anon_select_profiles" ON profiles FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_profiles" ON profiles;
CREATE POLICY "anon_insert_profiles" ON profiles FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_profiles" ON profiles;
CREATE POLICY "anon_update_profiles" ON profiles FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_profiles" ON profiles;
CREATE POLICY "anon_delete_profiles" ON profiles FOR DELETE
  TO anon, authenticated USING (true);
