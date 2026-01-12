-- UPGRADE STORIES
-- Add a 'content' column so we can use the Markdown Editor properly.

ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS content text;
