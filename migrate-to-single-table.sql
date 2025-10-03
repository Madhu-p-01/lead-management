-- Migrate from authorized_users to user_profiles only
-- This eliminates the need for two tables and sync issues

-- Step 1: Ensure all users from authorized_users are in user_profiles
INSERT INTO user_profiles (id, email, role, is_authorized, created_at)
SELECT 
  u.id,
  u.email,
  COALESCE(au.role, 'user') as role,
  COALESCE(au.is_active, false) as is_authorized,
  COALESCE(au.created_at, NOW()) as created_at
FROM auth.users u
LEFT JOIN authorized_users au ON u.email = au.email
WHERE u.id NOT IN (SELECT id FROM user_profiles)
ON CONFLICT (id) DO UPDATE
SET 
  role = EXCLUDED.role,
  is_authorized = EXCLUDED.is_authorized;

-- Step 2: Add missing columns to user_profiles if they don't exist
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Step 3: Drop the authorized_users table (we don't need it anymore)
-- First check if it's a table or view and drop accordingly
DO $$ 
BEGIN
    -- Try to drop as table first
    EXECUTE 'DROP TABLE IF EXISTS authorized_users CASCADE';
EXCEPTION 
    WHEN OTHERS THEN
        -- If it fails, try as view
        EXECUTE 'DROP VIEW IF EXISTS authorized_users CASCADE';
END $$;

-- Step 4: Create a view for backward compatibility (optional)
CREATE OR REPLACE VIEW authorized_users AS
SELECT 
  ROW_NUMBER() OVER (ORDER BY created_at) as id,
  email,
  role,
  is_authorized as is_active,
  added_by,
  created_at
FROM user_profiles
WHERE is_authorized = true;

-- Verify migration
SELECT 
  email,
  role,
  is_authorized,
  has_category_restrictions
FROM user_profiles
ORDER BY created_at DESC;
