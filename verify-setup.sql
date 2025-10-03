-- Verify the current setup

-- 1. Check if authorized_users view exists
SELECT 
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE viewname = 'authorized_users';

-- 2. Check actual data in user_profiles
SELECT 
  email,
  role,
  is_authorized,
  has_category_restrictions
FROM user_profiles
ORDER BY created_at DESC;

-- 3. Check what the view returns
SELECT * FROM authorized_users ORDER BY created_at DESC;

-- 4. If the view doesn't exist or is wrong, recreate it
DROP VIEW IF EXISTS authorized_users CASCADE;

CREATE OR REPLACE VIEW authorized_users AS
SELECT 
  ROW_NUMBER() OVER (ORDER BY created_at DESC) as id,
  email,
  role,
  is_authorized as is_active,
  added_by,
  created_at
FROM user_profiles
WHERE is_authorized = true;

-- 5. Test the view again
SELECT * FROM authorized_users ORDER BY created_at DESC;
