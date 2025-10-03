-- Force drop and recreate the authorized_users view

-- Step 1: Drop the view (it's already a view, not a table)
DROP VIEW IF EXISTS authorized_users CASCADE;

-- Step 2: Create the view
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

-- Step 3: Verify the view works
SELECT * FROM authorized_users ORDER BY created_at DESC;

-- Step 4: Check user_profiles table
SELECT 
  email,
  role,
  is_authorized,
  has_category_restrictions
FROM user_profiles
ORDER BY created_at DESC;
