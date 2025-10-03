-- Check user roles in the database
-- Run this to see what roles users actually have

SELECT 
  up.email,
  up.role as "profile_role",
  up.is_authorized,
  au.role as "authorized_users_role",
  au.is_active
FROM user_profiles up
LEFT JOIN authorized_users au ON up.email = au.email
ORDER BY up.email;

-- If you see users with role 'user' who should be 'admin' or 'superadmin',
-- run this to fix them:

-- UPDATE user_profiles
-- SET role = (SELECT role FROM authorized_users WHERE email = user_profiles.email)
-- WHERE email IN (SELECT email FROM authorized_users WHERE is_active = true);
