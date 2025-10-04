-- Add query column to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS query TEXT;

-- Add comment for documentation
COMMENT ON COLUMN leads.query IS 'Search query or keywords associated with this lead';
