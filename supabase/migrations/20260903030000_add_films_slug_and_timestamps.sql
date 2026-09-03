-- Migration: Add slug, updated_at, and video_published_at to public.films
alter table public.films
add column if not exists slug text,
add column if not exists updated_at timestamptz not null default timezone('utc'::text, now()),
add column if not exists video_published_at timestamptz;

-- Helper function to slugify text safely in Postgres
create or replace function public.slugify_film_title(raw_title text)
returns text
language plpgsql
immutable
as $$
declare
  cleaned text;
begin
  cleaned := lower(trim(coalesce(raw_title, '')));
  cleaned := regexp_replace(cleaned, '[^a-z0-9]+', '-', 'g');
  cleaned := regexp_replace(cleaned, '^-+|-+$', '', 'g');
  if cleaned = '' then
    cleaned := 'film';
  end if;
  return cleaned;
end;
$$;

-- Backfill slugs for existing records where slug is null or empty
with numbered_films as (
  select
    id,
    public.slugify_film_title(title) as base_slug,
    row_number() over (
      partition by public.slugify_film_title(title)
      order by created_at asc, id asc
    ) as dup_idx
  from public.films
  where slug is null or slug = ''
)
update public.films f
set slug = case
  when nf.dup_idx = 1 then nf.base_slug
  else nf.base_slug || '-' || nf.dup_idx
end
from numbered_films nf
where f.id = nf.id;

create unique index if not exists films_slug_lower_idx
on public.films ((lower(slug)))
where slug is not null;

-- Trigger to maintain updated_at on films
create or replace function public.set_films_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_films_updated_at on public.films;
create trigger set_films_updated_at
before update on public.films
for each row
execute function public.set_films_updated_at();

comment on column public.films.slug is 'Unique SEO and crawlable URL identifier for the film.';
comment on column public.films.video_published_at is 'Original publication date/time of the video if known.';
