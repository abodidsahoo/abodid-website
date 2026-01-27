-- Cleanup Migration: Remove Webflow-mirror table
-- User requested "clean Supabase based web content only"
-- We are removing the 'invisible_punctum_images' table as the game now uses 'photography'.

DROP TABLE IF EXISTS public.invisible_punctum_images;
