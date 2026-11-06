-- Add driver_license_url column (the driver's own license, distinct from vehicle_license_url)
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS driver_license_url text;

-- Create driver-photos bucket for all driver photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-photos', 'driver-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: anyone can read, authenticated can upload
CREATE POLICY "driver_photos_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'driver-photos');

CREATE POLICY "driver_photos_authenticated_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'driver-photos');

CREATE POLICY "driver_photos_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'driver-photos');

CREATE POLICY "driver_photos_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'driver-photos');