-- Fix category restrictions for users

-- 1. Check current state
SELECT 
  email,
  role,
  is_authorized,
  has_category_restrictions,
  CASE 
    WHEN has_category_restrictions IS NULL THEN 'NULL'
    WHEN has_category_restrictions = true THEN 'TRUE'
    ELSE 'FALSE'
  END as restriction_status
FROM user_profiles
WHERE role NOT IN ('admin', 'superadmin')
ORDER BY email;

-- 2. Set has_category_restrictions to TRUE for all regular users (not admins)
UPDATE user_profiles
SET has_category_restrictions = TRUE
WHERE role NOT IN ('admin', 'superadmin');

-- 3. Set has_category_restrictions to FALSE for admins
UPDATE user_profiles
SET has_category_restrictions = FALSE
WHERE role IN ('admin', 'superadmin');

-- 4. Verify the changes
SELECT 
  email,
  role,
  is_authorized,
  has_category_restrictions,
  (SELECT COUNT(*) FROM user_category_assignments WHERE user_id = user_profiles.id) as assigned_categories
FROM user_profiles
ORDER BY role, email;

-- 5. Show users who have restrictions but no assigned categories
SELECT 
  email,
  role,
  has_category_restrictions
FROM user_profiles
WHERE has_category_restrictions = TRUE
  AND id NOT IN (SELECT DISTINCT user_id FROM user_category_assignments)
  AND role NOT IN ('admin', 'superadmin');
