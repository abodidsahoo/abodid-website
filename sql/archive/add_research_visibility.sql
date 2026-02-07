-- Add visibility column to research table
-- This allows you to hide projects from the research page without unpublishing them

ALTER TABLE research 
ADD COLUMN IF NOT EXISTS visible BOOLEAN DEFAULT true;

-- Update existing rows to be visible by default
UPDATE research 
SET visible = true 
WHERE visible IS NULL;

-- Add a comment to document the column
COMMENT ON COLUMN research.visible IS 'Controls whether the project appears on the /research page. Hidden projects are still accessible via direct URL.';
