-- Adds art/commercial classification flags for each photo story row.

alter table public.photo_stories
    add column if not exists is_art boolean not null default false,
    add column if not exists is_commercial boolean not null default false;
