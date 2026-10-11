alter table public.moodboard_items
    add column if not exists source_url text,
    add column if not exists artist_name text;

comment on column public.moodboard_items.source_url is
    'Webpage where the image was captured, when supplied by the browser extension.';

comment on column public.moodboard_items.artist_name is
    'Best-effort creator name or social handle found on the capture page; null when uncertain.';
