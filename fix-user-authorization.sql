-- Fix authorization for existing users
-- Run this in Supabase SQL Editor after adding users to authorized_users table

-- Update user profiles for all users in authorized_users
UPDATE user_profiles
SET 
  is_authorized = true,
  role = (SELECT role FROM authorized_users WHERE email = user_profiles.email AND is_active = true)
WHERE email IN (SELECT email FROM authorized_users WHERE is_active = true);

-- If the user doesn't have a profile yet, create it
INSERT INTO user_profiles (id, email, role, is_authorized)
SELECT 
  u.id,
  u.email,
  az.role,
  az.is_active
FROM auth.users u
JOIN authorized_users az ON u.email = az.email
WHERE az.is_active = true
  AND u.id NOT IN (SELECT id FROM user_profiles)
ON CONFLICT (id) DO UPDATE
SET 
  is_authorized = EXCLUDED.is_authorized,
  role = EXCLUDED.role;

-- Verify the updates
SELECT 
  up.email,
  up.role,
  up.is_authorized,
  au.is_active as "active_in_authorized_users"
FROM user_profiles up
LEFT JOIN authorized_users au ON up.email = au.email
WHERE up.email IN ('madhu.p@syntellite.com', 'syedroshan@syntellite.com')
ORDER BY up.email;
