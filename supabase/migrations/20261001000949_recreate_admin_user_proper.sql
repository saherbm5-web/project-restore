-- Create admin auth user with all required fields for GoTrue
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@fontaxi.jo',
  crypt('Admin123!', gen_salt('bf', 10)),
  now(),
  now(),
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  '',
  '',
  '',
  ''
);

-- Link admin profile to the auth user
INSERT INTO profiles (email, role, phone, name, user_id)
SELECT 'admin@fontaxi.jo', 'admin', 'admin', 'مدير النظام', id
FROM auth.users WHERE email = 'admin@fontaxi.jo';