-- Add weight column to kpi_domains if it doesn't exist
ALTER TABLE public.kpi_domains 
ADD COLUMN IF NOT EXISTS weight DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (weight >= 0 AND weight <= 100);

-- Update existing domains to have some weight (distribute evenly or set default)
-- This is a best-effort fix for existing data. 
-- In a real scenario, we might want to manually set these, but to fix the report immediately for the user:
UPDATE public.kpi_domains
SET weight = 50
WHERE weight = 0;
