-- Add assigned_to column to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);

-- Update RLS policies to allow users to see their assigned leads
DROP POLICY IF EXISTS "Users can view their assigned leads" ON leads;
CREATE POLICY "Users can view their assigned leads"
ON leads FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM user_profiles WHERE role IN ('admin', 'superadmin')
  )
  OR assigned_to = auth.uid()
);

-- Allow admins to update assigned_to
DROP POLICY IF EXISTS "Admins can update leads" ON leads;
CREATE POLICY "Admins can update leads"
ON leads FOR UPDATE
USING (
  auth.uid() IN (
    SELECT user_id FROM user_profiles WHERE role IN ('admin', 'superadmin')
  )
);
