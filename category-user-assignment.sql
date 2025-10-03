-- Category User Assignment Feature
-- This allows assigning specific categories to specific users

-- Create user_category_assignments table
CREATE TABLE IF NOT EXISTS user_category_assignments (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, category_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_category_user_id ON user_category_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_category_category_id ON user_category_assignments(category_id);

-- Enable RLS
ALTER TABLE user_category_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own category assignments" ON user_category_assignments;
CREATE POLICY "Users can view their own category assignments"
  ON user_category_assignments FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all category assignments" ON user_category_assignments;
CREATE POLICY "Admins can view all category assignments"
  ON user_category_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "Admins can insert category assignments" ON user_category_assignments;
CREATE POLICY "Admins can insert category assignments"
  ON user_category_assignments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

DROP POLICY IF EXISTS "Admins can delete category assignments" ON user_category_assignments;
CREATE POLICY "Admins can delete category assignments"
  ON user_category_assignments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- Add a column to user_profiles to indicate if user has category restrictions
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS has_category_restrictions BOOLEAN DEFAULT TRUE;

-- Update existing users to have restrictions enabled (except admins)
UPDATE user_profiles
SET has_category_restrictions = TRUE
WHERE role NOT IN ('admin', 'superadmin');

-- Function to check if a user can access a category
CREATE OR REPLACE FUNCTION user_can_access_category(
  p_user_id UUID,
  p_category_id BIGINT
) RETURNS BOOLEAN AS $$
DECLARE
  v_has_restrictions BOOLEAN;
  v_is_admin BOOLEAN;
BEGIN
  -- Check if user is admin/superadmin (they can access all categories)
  SELECT role IN ('admin', 'superadmin') INTO v_is_admin
  FROM user_profiles
  WHERE id = p_user_id;
  
  IF v_is_admin THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user has category restrictions
  SELECT has_category_restrictions INTO v_has_restrictions
  FROM user_profiles
  WHERE id = p_user_id;
  
  -- If no restrictions, user can access all categories
  IF NOT v_has_restrictions THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user has access to this specific category
  RETURN EXISTS (
    SELECT 1 FROM user_category_assignments
    WHERE user_id = p_user_id AND category_id = p_category_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify setup
SELECT 'Category User Assignment Setup Complete!' as status;
