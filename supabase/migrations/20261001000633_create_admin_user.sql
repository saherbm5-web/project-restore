-- Create admin auth user
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
VALUES (
  gen_random_uuid(),
  'admin@fontaxi.jo',
  crypt('Admin123!', gen_salt('bf')),
  now(),
  now(),
  now(),
  'authenticated',
  'authenticated'
);

-- Insert admin profile
INSERT INTO profiles (email, role, phone, name)
VALUES ('admin@fontaxi.jo', 'admin', 'admin', 'مدير النظام');