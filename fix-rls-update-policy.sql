-- Fix RLS policy to allow admins to update user_profiles

-- Drop existing update policies
DROP POLICY IF EXISTS "Admins can update user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON user_profiles;

-- Create a comprehensive update policy for admins
CREATE POLICY "Admins can update all user profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    -- Allow if the current user is an admin or superadmin
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
      AND is_authorized = true
    )
  )
  WITH CHECK (
    -- Allow if the current user is an admin or superadmin
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
      AND is_authorized = true
    )
  );

-- Also allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Verify policies
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_profiles' AND cmd = 'UPDATE';

-- Test the update again
UPDATE user_profiles
SET role = 'admin'
WHERE email = 'syedroshan@syntellite.com'
RETURNING email, role, is_authorized;
