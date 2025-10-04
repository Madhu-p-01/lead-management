-- Add assigned_to column to leads table
-- This allows tracking which user is assigned to each lead

-- Add the column
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);

-- Add comment for documentation
COMMENT ON COLUMN leads.assigned_to IS 'User ID of the person assigned to this lead';

-- Verify the change
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'leads' AND column_name = 'assigned_to';
