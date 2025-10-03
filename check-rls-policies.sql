-- Check RLS policies on user_profiles

-- 1. Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'user_profiles';

-- 2. Check existing policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_profiles';

-- 3. Grant necessary permissions
GRANT ALL ON user_profiles TO authenticated;
GRANT ALL ON user_profiles TO service_role;

-- 4. Create/update policy for admins to update user_profiles
DROP POLICY IF EXISTS "Admins can update user profiles" ON user_profiles;
CREATE POLICY "Admins can update user profiles"
  ON user_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() 
      AND up.role IN ('admin', 'superadmin')
    )
  );

-- 5. Test update manually
-- Replace 'careers@syntellite.com' with the email you're trying to update
UPDATE user_profiles
SET role = 'admin'
WHERE email = 'careers@syntellite.com'
RETURNING *;

-- 6. Verify the update
SELECT email, role, is_authorized FROM user_profiles WHERE email = 'careers@syntellite.com';
