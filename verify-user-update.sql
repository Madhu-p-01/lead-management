-- Verify user role update functionality

-- 1. Check current user (you should be logged in as superadmin)
SELECT 
  email,
  role,
  is_authorized
FROM user_profiles
WHERE email = 'madhu.p@syntellite.com';

-- 2. Check RLS policies for UPDATE
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE tablename = 'user_profiles' AND cmd = 'UPDATE';

-- 3. Try a test update (change email to the user you're trying to update)
UPDATE user_profiles
SET role = 'admin'
WHERE email = 'syedroshan@syntellite.com'
RETURNING email, role, is_authorized;

-- 4. Verify the update worked
SELECT 
  email,
  role,
  is_authorized
FROM user_profiles
WHERE email = 'syedroshan@syntellite.com';

-- 5. Check if the view is showing the updated data
SELECT * FROM authorized_users 
WHERE email = 'syedroshan@syntellite.com';
