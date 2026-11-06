-- Storage policies for driver-docs bucket
CREATE POLICY "anon_upload_driver_docs" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'driver-docs');

CREATE POLICY "anon_select_driver_docs" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'driver-docs');

CREATE POLICY "anon_delete_driver_docs" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'driver-docs');
