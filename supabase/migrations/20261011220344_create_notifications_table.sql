/*
# Create notifications table for driver-arrived alerts

1. New Tables
- `notifications`
  - `id` (uuid, primary key)
  - `user_id` (text, identifies the customer by phone or auth user id)
  - `type` (text, notification type e.g. 'driver_arrived')
  - `body` (text, notification message)
  - `ride_id` (uuid, optional reference to the ride)
  - `driver_name` (text, optional driver display name)
  - `driver_phone` (text, optional driver phone for call button)
  - `read` (boolean, default false)
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `notifications`.
- Allow anon + authenticated CRUD (app uses anon key, no strict auth on this table).
*/

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  type text NOT NULL DEFAULT 'driver_arrived',
  body text,
  ride_id uuid,
  driver_name text,
  driver_phone text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_notifications" ON notifications;
CREATE POLICY "anon_select_notifications" ON notifications FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_notifications" ON notifications;
CREATE POLICY "anon_insert_notifications" ON notifications FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_notifications" ON notifications;
CREATE POLICY "anon_update_notifications" ON notifications FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_notifications" ON notifications;
CREATE POLICY "anon_delete_notifications" ON notifications FOR DELETE
  TO anon, authenticated USING (true);
