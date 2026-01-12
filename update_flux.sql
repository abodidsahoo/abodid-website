-- AUTO-UPDATE: Into The Flux
-- This script does two things:
-- 1. Ensures the 'content' column exists.
-- 2. Inserts your images as Markdown into the 'Into The Flux' story.

-- 1. (Safety Check) Add column if missing
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS content text;

-- 2. Update the Content
UPDATE public.stories
SET 
  published = true,
  content = E'![London 3](https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/portfolio-assets/stories/into-the-flux/1768199952743-into-the-flux-iba-london3.jpg)\n\n![London 7](https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/portfolio-assets/stories/into-the-flux/1768199966039-into-the-flux-iba-london7.jpg)\n\n![London 32](https://jwipqbjxpmgyevfzpjjx.supabase.co/storage/v1/object/public/portfolio-assets/stories/into-the-flux/1768199976563-into-the-flux-iba-london32.jpg)'
WHERE 
  slug = 'into-the-flux' OR title ILIKE 'Into The Flux';
