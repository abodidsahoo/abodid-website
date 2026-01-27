-- Remove legacy Webflow CDN links from photo_feedback
-- User requested to remove "webflow base CDN and links" as they are no longer needed.
-- We are keeping only the rows that point to Supabase Storage (which include the 'Force Migrated' ones).

DELETE FROM public.photo_feedback
WHERE image_url LIKE '%cdn.prod.website-files.com%';
