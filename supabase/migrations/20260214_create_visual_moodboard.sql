-- Visual Moodboard schema
-- Supports flexible per-image tags, fuzzy keyword matching, and admin-managed publishing.

create extension if not exists pg_trgm;

create table if not exists public.moodboard_items (
    id uuid primary key default gen_random_uuid(),
    image_url text not null,
    storage_path text not null unique,
    title text not null default '',
    tags text[] not null default '{}',
    published boolean not null default true,
    created_at timestamp with time zone not null default timezone('utc'::text, now()),
    updated_at timestamp with time zone not null default timezone('utc'::text, now()),
    search_text text not null default ''
);

create index if not exists idx_moodboard_items_created_at
on public.moodboard_items (created_at desc);

create index if not exists idx_moodboard_items_tags
on public.moodboard_items using gin (tags);

create index if not exists idx_moodboard_items_search_trgm
on public.moodboard_items using gin (search_text gin_trgm_ops);

create or replace function public.set_moodboard_item_derived_fields()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc'::text, now());
    new.search_text = lower(
        trim(
            coalesce(new.title, '') || ' ' || array_to_string(coalesce(new.tags, '{}'::text[]), ' ')
        )
    );
    return new;
end;
$$;

drop trigger if exists trg_moodboard_items_derived_fields on public.moodboard_items;
create trigger trg_moodboard_items_derived_fields
before insert or update on public.moodboard_items
for each row
execute function public.set_moodboard_item_derived_fields();

-- Backfill for any existing rows (safe no-op on empty tables).
update public.moodboard_items
set search_text = lower(
    trim(
        coalesce(title, '') || ' ' || array_to_string(coalesce(tags, '{}'::text[]), ' ')
    )
)
where coalesce(search_text, '') = '';

create or replace function public.search_moodboard_items(
    q text default '',
    lim int default 200
)
returns setof public.moodboard_items
language sql
stable
as $$
    select mi.*
    from public.moodboard_items mi
    where mi.published = true
      and (
        nullif(trim(q), '') is null
        or mi.search_text ilike '%' || lower(trim(q)) || '%'
      )
    order by mi.created_at desc
    limit greatest(lim, 1);
$$;

alter table public.moodboard_items enable row level security;

drop policy if exists "Public can read published moodboard items" on public.moodboard_items;
create policy "Public can read published moodboard items"
on public.moodboard_items
for select
using (published = true);

drop policy if exists "Admins can read all moodboard items" on public.moodboard_items;
create policy "Admins can read all moodboard items"
on public.moodboard_items
for select
using (
    exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'admin'
    )
);

drop policy if exists "Admins can insert moodboard items" on public.moodboard_items;
create policy "Admins can insert moodboard items"
on public.moodboard_items
for insert
with check (
    exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'admin'
    )
);

drop policy if exists "Admins can update moodboard items" on public.moodboard_items;
create policy "Admins can update moodboard items"
on public.moodboard_items
for update
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

drop policy if exists "Admins can delete moodboard items" on public.moodboard_items;
create policy "Admins can delete moodboard items"
on public.moodboard_items
for delete
using (
    exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'admin'
    )
);

revoke all on function public.search_moodboard_items(text, int) from public;
grant execute on function public.search_moodboard_items(text, int) to anon;
grant execute on function public.search_moodboard_items(text, int) to authenticated;
