-- Add nationality column to categories table (not leads table)
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT 'National' CHECK (nationality IN ('National', 'International'));

-- Add comment for documentation
COMMENT ON COLUMN categories.nationality IS 'Indicates if the category is National or International';
