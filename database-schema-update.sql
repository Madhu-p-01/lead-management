-- Create competitors table to store detailed competitor information
CREATE TABLE IF NOT EXISTS competitors (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  link TEXT,
  reviews INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_competitors_lead_id ON competitors(lead_id);

-- Optional: Remove competitors column from leads table if you want
-- (Keep it commented out for now in case you want to keep both)
-- ALTER TABLE leads DROP COLUMN IF EXISTS competitors;
