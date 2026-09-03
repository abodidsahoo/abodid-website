-- Migration: Add slug and updated_at to public.research_papers
alter table public.research_papers
add column if not exists slug text,
add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

-- Helper function to slugify text safely in Postgres
create or replace function public.slugify_paper_title(raw_title text)
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
    cleaned := 'paper';
  end if;
  return cleaned;
end;
$$;

-- Backfill slugs for existing records where slug is null or empty
with numbered_papers as (
  select
    id,
    public.slugify_paper_title(title) as base_slug,
    row_number() over (
      partition by public.slugify_paper_title(title)
      order by created_at asc, id asc
    ) as dup_idx
  from public.research_papers
  where slug is null or slug = ''
)
update public.research_papers p
set slug = case
  when np.dup_idx = 1 then np.base_slug
  else np.base_slug || '-' || np.dup_idx
end
from numbered_papers np
where p.id = np.id;

create unique index if not exists research_papers_slug_lower_idx
on public.research_papers ((lower(slug)))
where slug is not null;

-- Trigger to maintain updated_at on research_papers
create or replace function public.set_research_papers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_research_papers_updated_at on public.research_papers;
create trigger set_research_papers_updated_at
before update on public.research_papers
for each row
execute function public.set_research_papers_updated_at();

comment on column public.research_papers.slug is 'Unique SEO and crawlable URL identifier for the curated research paper.';
