-- PHOTO STORIES
-- Adds a per-image story store that can be edited from admin and rendered on landing.

create table if not exists public.photo_stories (
    id uuid primary key default gen_random_uuid(),
    photo_url text not null unique,
    story_markdown text not null default '',
    genre text,
    created_at timestamp with time zone not null default timezone('utc'::text, now()),
    updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists idx_photo_stories_updated_at
on public.photo_stories (updated_at desc);

-- Keep updated_at fresh whenever story content changes.
create or replace function public.set_photo_story_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$;

drop trigger if exists trg_photo_stories_updated_at on public.photo_stories;
create trigger trg_photo_stories_updated_at
before update on public.photo_stories
for each row
execute function public.set_photo_story_updated_at();

alter table public.photo_stories enable row level security;

drop policy if exists "Public read photo stories" on public.photo_stories;
create policy "Public read photo stories"
on public.photo_stories
for select
using (true);

drop policy if exists "Admins can insert photo stories" on public.photo_stories;
create policy "Admins can insert photo stories"
on public.photo_stories
for insert
with check (
    exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'admin'
    )
);

drop policy if exists "Admins can update photo stories" on public.photo_stories;
create policy "Admins can update photo stories"
on public.photo_stories
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

drop policy if exists "Admins can delete photo stories" on public.photo_stories;
create policy "Admins can delete photo stories"
on public.photo_stories
for delete
using (
    exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and role = 'admin'
    )
);

-- Initial backfill so every existing photo has an editable row immediately.
with photography_urls as (
    select nullif(trim(p.cover_image), '') as photo_url
    from public.photography p
    union
    select nullif(trim(g.item ->> 'url'), '') as photo_url
    from public.photography p
    cross join lateral jsonb_array_elements(
        case
            when jsonb_typeof(p.gallery_images) = 'array' then p.gallery_images
            else '[]'::jsonb
        end
    ) as g(item)
),
cleaned as (
    select distinct photo_url
    from photography_urls
    where photo_url is not null
)
insert into public.photo_stories (photo_url)
select photo_url
from cleaned
on conflict (photo_url) do nothing;

-- Admin-invoked sync for future uploads/new photos.
create or replace function public.sync_photo_stories_from_photography()
returns table(inserted_count integer, total_rows integer)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_inserted integer := 0;
    v_total integer := 0;
begin
    if auth.uid() is null
       or not exists (
            select 1
            from public.profiles
            where id = auth.uid()
              and role = 'admin'
        ) then
        raise exception 'Only admins can run sync_photo_stories_from_photography()';
    end if;

    with photography_urls as (
        select nullif(trim(p.cover_image), '') as photo_url
        from public.photography p
        union
        select nullif(trim(g.item ->> 'url'), '') as photo_url
        from public.photography p
        cross join lateral jsonb_array_elements(
            case
                when jsonb_typeof(p.gallery_images) = 'array' then p.gallery_images
                else '[]'::jsonb
            end
        ) as g(item)
    ),
    cleaned as (
        select distinct photo_url
        from photography_urls
        where photo_url is not null
    ),
    inserted as (
        insert into public.photo_stories (photo_url)
        select photo_url
        from cleaned
        on conflict (photo_url) do nothing
        returning 1
    )
    select count(*) into v_inserted
    from inserted;

    select count(*) into v_total
    from public.photo_stories;

    return query
    select v_inserted, v_total;
end;
$$;

revoke all on function public.sync_photo_stories_from_photography() from public;
grant execute on function public.sync_photo_stories_from_photography() to authenticated;
