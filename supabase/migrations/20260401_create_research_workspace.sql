-- Research Workspace storage and metadata foundation.
-- Keeps uploaded PDFs private in storage and stores extraction/insight metadata
-- in a dedicated table for the Rename & Insights workflow.

create table if not exists public.research_papers (
    id uuid primary key default gen_random_uuid(),
    original_filename text not null,
    cleaned_filename text,
    preferred_filename text,
    display_title text,
    source_type text not null check (source_type in ('file', 'link')),
    source_url text,
    storage_bucket text not null default 'research-papers',
    storage_path text not null unique,
    doi text,
    authors_json jsonb not null default '[]'::jsonb,
    year integer,
    journal text,
    abstract text,
    upload_status text not null default 'pending' check (upload_status in ('pending', 'uploading', 'uploaded', 'failed')),
    extraction_status text not null default 'pending' check (extraction_status in ('pending', 'processing', 'complete', 'partial', 'failed')),
    insight_status text not null default 'idle' check (insight_status in ('idle', 'processing', 'ready', 'failed')),
    metadata_json jsonb not null default '{}'::jsonb,
    page_map_json jsonb not null default '[]'::jsonb,
    insights_json jsonb,
    warnings_json jsonb not null default '[]'::jsonb,
    created_at timestamp with time zone not null default timezone('utc'::text, now()),
    updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists idx_research_papers_created_at
on public.research_papers (created_at desc);

create index if not exists idx_research_papers_doi
on public.research_papers (doi);

create index if not exists idx_research_papers_preferred_filename
on public.research_papers (preferred_filename);

create or replace function public.set_research_papers_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$;

drop trigger if exists trg_research_papers_updated_at on public.research_papers;
create trigger trg_research_papers_updated_at
before update on public.research_papers
for each row
execute function public.set_research_papers_updated_at();

alter table public.research_papers enable row level security;

drop policy if exists "Admins can read research papers" on public.research_papers;
create policy "Admins can read research papers"
on public.research_papers
for select
using (
    exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'admin'
    )
);

drop policy if exists "Admins can manage research papers" on public.research_papers;
create policy "Admins can manage research papers"
on public.research_papers
for all
using (
    exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'admin'
    )
)
with check (
    exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'admin'
    )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'research-papers',
    'research-papers',
    false,
    26214400,
    array['application/pdf']
)
on conflict (id) do update
set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can read research papers bucket" on storage.objects;
create policy "Admins can read research papers bucket"
on storage.objects
for select
using (
    bucket_id = 'research-papers'
    and exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'admin'
    )
);

drop policy if exists "Admins can upload research papers" on storage.objects;
create policy "Admins can upload research papers"
on storage.objects
for insert
with check (
    bucket_id = 'research-papers'
    and split_part(name, '/', 1) = 'papers'
    and exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'admin'
    )
);

drop policy if exists "Admins can update research papers bucket" on storage.objects;
create policy "Admins can update research papers bucket"
on storage.objects
for update
using (
    bucket_id = 'research-papers'
    and split_part(name, '/', 1) = 'papers'
    and exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'admin'
    )
)
with check (
    bucket_id = 'research-papers'
    and split_part(name, '/', 1) = 'papers'
    and exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'admin'
    )
);

drop policy if exists "Admins can delete research papers bucket" on storage.objects;
create policy "Admins can delete research papers bucket"
on storage.objects
for delete
using (
    bucket_id = 'research-papers'
    and split_part(name, '/', 1) = 'papers'
    and exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'admin'
    )
);
