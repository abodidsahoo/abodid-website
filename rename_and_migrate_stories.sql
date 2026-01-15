-- 1. Rename Table 'stories' to 'photography'
ALTER TABLE IF EXISTS public.stories RENAME TO photography;

-- 2. BLOG: Add 'category' column as an Array of Text
ALTER TABLE public.blog 
ADD COLUMN IF NOT EXISTS category text[] DEFAULT '{}';

-- Populate Blog Categories (Example Mappings based on Logic)
UPDATE public.blog 
SET category = ARRAY['Journal'] 
WHERE category IS NULL OR category = '{}';


-- 3. PHOTOGRAPHY: Convert existing 'category' text to text[] Array
-- This wraps existing single values in an array (e.g. 'Travel' -> ['Travel'])
ALTER TABLE public.photography 
ALTER COLUMN category TYPE text[] 
USING CASE 
    WHEN category IS NULL THEN '{}' 
    ELSE ARRAY[category] 
END;

-- Set default for future inserts
ALTER TABLE public.photography 
ALTER COLUMN category SET DEFAULT '{}';


-- 4. VERIFICATION
SELECT slug, title, category FROM public.blog LIMIT 5;
SELECT slug, title, category FROM public.photography LIMIT 5;
