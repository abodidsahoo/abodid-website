-- Adds sample-story support so seeded demo text is visible without marking a story as manually locked.

alter table public.photo_stories
    add column if not exists sample_story_markdown text not null default '',
    add column if not exists is_story_locked boolean not null default false;

-- Preserve existing manually entered stories as locked.
update public.photo_stories
set is_story_locked = true
where coalesce(trim(story_markdown), '') <> '';
