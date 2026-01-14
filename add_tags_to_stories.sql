-- 1. Add the tags column
ALTER TABLE public.photography 
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- 2. Populate tags (Optimized for Overlap/Commonalities)

-- "Into the Flux"
-- Overlaps: London, Color
UPDATE public.photography 
SET tags = ARRAY['Street', 'Motion', 'Urban', 'London', 'Color']
WHERE slug = 'into-the-flux';

-- "RCA Gradshow in London"
-- Overlaps: London, Art
UPDATE public.photography 
SET tags = ARRAY['Exhibition', 'Art', 'London', 'Gallery', 'RCA']
WHERE slug = 'rca-gradshow-in-london';

-- "Ting Photoshoot"
-- Overlaps: Color, Art
UPDATE public.photography 
SET tags = ARRAY['Portrait', 'Fashion', 'Studio', 'Color', 'Art']
WHERE slug = 'ting-photoshoot';

-- 3. Verify
SELECT slug, title, tags FROM public.photography;
