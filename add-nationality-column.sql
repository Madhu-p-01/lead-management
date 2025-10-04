-- Add nationality column to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT 'National' CHECK (nationality IN ('National', 'International'));

-- Add comment for documentation
COMMENT ON COLUMN leads.nationality IS 'Indicates if the lead is National or International';
