-- 1. Add the tags column to 'blog' table
ALTER TABLE public.blog 
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- 2. Populate tags for the REAL blog posts

-- "How Photographing My Seniors’ Work Turned Into New Friendships"
-- Themes: RCA context, Photography process, Networking/Community, Personal reflection
UPDATE public.blog 
SET tags = ARRAY['RCA', 'Photography', 'Community', 'Exhibition', 'Personal']
WHERE slug = 'how-photographing-my-seniors-work-turned-into-new-friendships';

-- "When the Staff Steal the Spotlight: Inside RCA’s Most Surprising Exhibition"
-- Themes: RCA, Exhibition (Hidden), Staff works, London context, Creativity
UPDATE public.blog 
SET tags = ARRAY['RCA', 'Exhibition', 'London', 'Creativity', 'Community']
WHERE slug = 'when-the-staff-steal-the-spotlight-inside-rca-most-surprising-exhibition';

-- 3. Verify
SELECT slug, title, tags FROM public.blog;
