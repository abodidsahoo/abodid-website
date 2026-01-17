-- cleanup_digital_footprint.sql

/*
  Cleanup Script for Digital Footprint (Press / Media Mentions)
  
  Target Table: public.media_mentions
  
  Goals:
  1. Consolidate 'Editing', 'Direction', 'Production' -> 'Film'.
  2. Limit tags to strictly: ['Film', 'Feature', 'Collaboration', 'Interview', 'Consulting', 'Work'].
  3. Remove any other tags.
  4. Ensure every article has at least one tag (Default to 'Work' if all tags were removed).
  5. DO NOT delete or unpublish any articles.
*/

-- 1. Standardize / Consolidate known variations first
UPDATE public.media_mentions
SET categories = (
    SELECT array_agg(DISTINCT replacement)
    FROM (
        SELECT CASE 
            WHEN tag IN ('Editing', 'Direction', 'Production') THEN 'Film'
            -- Add more mappings here if needed, e.g. 'Press' -> 'Feature'
            WHEN tag = 'Press' THEN 'Feature'
            WHEN tag = 'Mention' THEN 'Feature'
            ELSE tag 
        END as replacement
        FROM unnest(categories) as tag
    ) sub
);


-- 2. Filter to ONLY allowed tags
-- Allowed: Film, Feature, Collaboration, Interview, Consulting, Work
UPDATE public.media_mentions
SET categories = (
    SELECT array_agg(DISTINCT tag)
    FROM unnest(categories) as tag
    WHERE tag IN ('Film', 'Feature', 'Collaboration', 'Interview', 'Consulting', 'Work')
);


-- 3. Safety: If an article has 0 tags after cleanup, give it a default (e.g., 'Work')
UPDATE public.media_mentions
SET categories = ARRAY['Work']
WHERE categories IS NULL OR array_length(categories, 1) IS NULL;

