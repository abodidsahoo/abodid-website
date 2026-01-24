-- MIGRATION: Tagging System Upgrade
-- 1. Enable pg_trgm for fuzzy search/autocomplete
create extension if not exists pg_trgm;

-- 2. Upgrade 'hub_tags' table
-- We keep 'id' as UUID to match existing system consistency, but add the requested fields.
-- We use 'hub_tags' instead of 'tags' to avoid conflicts and maintain relationship with 'hub_resources'.

alter table public.hub_tags
add column if not exists slug text generated always as (lower(regexp_replace(trim(name), '\s+', '-', 'g'))) stored unique,
add column if not exists is_featured boolean default false,
add column if not exists created_by uuid references auth.users(id),
add column if not exists created_at timestamp with time zone default now();

-- Ensure indexes
create index if not exists hub_tags_slug_idx on public.hub_tags(slug);
create index if not exists hub_tags_name_trgm_idx on public.hub_tags using gin (name gin_trgm_ops);

-- 3. Ensure 'hub_resource_tags' is correct (Join Table)
create table if not exists public.hub_resource_tags (
  resource_id uuid references public.hub_resources(id) on delete cascade,
  tag_id uuid references public.hub_tags(id) on delete cascade,
  created_at timestamp with time zone default now(),
  primary key (resource_id, tag_id)
);

-- 4. RLS Policies

-- Tags
alter table public.hub_tags enable row level security;

-- Public Read
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Public can view tags' and tablename = 'hub_tags') then
    create policy "Public can view tags" on public.hub_tags for select using (true);
  end if;
end $$;

-- Auth Insert
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Authenticated users can create tags' and tablename = 'hub_tags') then
    create policy "Authenticated users can create tags" on public.hub_tags for insert with check (auth.role() = 'authenticated');
  end if;
end $$;

-- Admin Update/Delete
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Admins can update tags' and tablename = 'hub_tags') then
    create policy "Admins can update tags" on public.hub_tags for update using (
      exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Admins can delete tags' and tablename = 'hub_tags') then
    create policy "Admins can delete tags" on public.hub_tags for delete using (
      exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    );
  end if;
end $$;

-- Resource Tags (Join Table)
alter table public.hub_resource_tags enable row level security;

-- Public Read
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Public can view resource tags' and tablename = 'hub_resource_tags') then
    create policy "Public can view resource tags" on public.hub_resource_tags for select using (true);
  end if;
end $$;

-- Auth Insert (Allow users to tag resources they are submitting, or any resource?)
-- For simplicity, authenticated users can tag access.
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Authenticated users can link tags' and tablename = 'hub_resource_tags') then
    create policy "Authenticated users can link tags" on public.hub_resource_tags for insert with check (auth.role() = 'authenticated');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'Authenticated users can unlink tags' and tablename = 'hub_resource_tags') then
    create policy "Authenticated users can unlink tags" on public.hub_resource_tags for delete using (auth.role() = 'authenticated');
  end if;
end $$;


-- 5. Helper Function for Autocomplete
-- Uses pg_trgm for similarity sorting
create or replace function search_tags(q text, lim int default 12)
returns setof public.hub_tags
language sql
stable
as $$
  select *
  from public.hub_tags
  where name ilike ('%' || q || '%')
  order by similarity(name, q) desc, name
  limit lim;
$$;
