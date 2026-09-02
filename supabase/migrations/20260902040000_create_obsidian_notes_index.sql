create table if not exists public.obsidian_notes (
  note_id text primary key,
  note_title text not null,
  file_path text not null unique,
  folder_path text,
  wiki_links text[] not null default '{}',
  is_public boolean not null default true,
  content_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.obsidian_notes enable row level security;

create index if not exists obsidian_notes_wiki_links_idx
on public.obsidian_notes
using gin (wiki_links);

create index if not exists obsidian_notes_public_idx
on public.obsidian_notes (is_public);

create or replace function public.set_obsidian_notes_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists set_obsidian_notes_updated_at on public.obsidian_notes;
create trigger set_obsidian_notes_updated_at
before update on public.obsidian_notes
for each row
execute function public.set_obsidian_notes_updated_at();

comment on table public.obsidian_notes is
  'One row per indexed Obsidian note for fast exact tag and wiki-link lookups.';

comment on column public.obsidian_notes.wiki_links is
  'Normalized lowercase Obsidian wiki-link targets extracted during vault ingestion.';
