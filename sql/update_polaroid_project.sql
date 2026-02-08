-- Rename "Polaroids Table" to "Polaroid Hub"
-- Update the slug to match the new directory structure: /research/polaroid-hub

UPDATE research
SET 
  title = 'Polaroid Hub',
  slug = 'polaroid-hub'
WHERE 
  slug = 'polaroid' OR title = 'Polaroids Table';

-- Verify the update
SELECT * FROM research WHERE slug = 'polaroid-hub';
