create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create table if not exists public.obsidian_chunks (
  id bigserial primary key,
  note_id text,
  note_title text not null,
  file_path text not null,
  folder_path text,
  heading text,
  chunk_index int not null,
  chunk_text text not null,
  frontmatter jsonb default '{}'::jsonb,
  tags text[] default '{}',
  embedding vector(1536),
  embedding_model text default 'openai/text-embedding-3-small',
  content_hash text not null,
  is_public boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(file_path, chunk_index)
);

alter table public.obsidian_chunks enable row level security;

create index if not exists obsidian_chunks_embedding_hnsw_idx
on public.obsidian_chunks
using hnsw (embedding vector_cosine_ops);

create index if not exists obsidian_chunks_note_title_trgm_idx
on public.obsidian_chunks
using gin (note_title gin_trgm_ops);

create index if not exists obsidian_chunks_file_path_trgm_idx
on public.obsidian_chunks
using gin (file_path gin_trgm_ops);

create index if not exists obsidian_chunks_tags_idx
on public.obsidian_chunks
using gin (tags);

create index if not exists obsidian_chunks_public_idx
on public.obsidian_chunks (is_public);

create or replace function public.set_obsidian_chunks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_obsidian_chunks_updated_at on public.obsidian_chunks;
create trigger set_obsidian_chunks_updated_at
before update on public.obsidian_chunks
for each row
execute function public.set_obsidian_chunks_updated_at();

create or replace function public.match_obsidian_chunks (
  query_embedding vector(1536),
  match_count int default 10,
  match_threshold float default 0.2,
  public_only boolean default true,
  tag_filter text default null,
  folder_filter text default null,
  file_path_filter text default null
)
returns table (
  id bigint,
  note_id text,
  note_title text,
  file_path text,
  folder_path text,
  heading text,
  chunk_index int,
  chunk_text text,
  tags text[],
  similarity float
)
language sql stable
as $$
  select
    oc.id,
    oc.note_id,
    oc.note_title,
    oc.file_path,
    oc.folder_path,
    oc.heading,
    oc.chunk_index,
    oc.chunk_text,
    oc.tags,
    1 - (oc.embedding <=> query_embedding) as similarity
  from public.obsidian_chunks oc
  where
    oc.embedding is not null
    and (public_only = false or oc.is_public = true)
    and (tag_filter is null or tag_filter = any(oc.tags))
    and (folder_filter is null or oc.folder_path ilike folder_filter || '%')
    and (file_path_filter is null or oc.file_path = file_path_filter)
    and 1 - (oc.embedding <=> query_embedding) > match_threshold
  order by oc.embedding <=> query_embedding
  limit match_count;
$$;
