-- Enforce curator-managed metadata for resource approvals.
-- This migration:
-- 1) Sets default audience to Designer for new submissions.
-- 2) Restricts tagging to staff (curator/admin).
-- 3) Creates/updates the hub thumbnail bucket and locks uploads to staff
--    under the folder prefix: resource-thumbnails/.

alter table public.hub_resources
alter column audience set default 'Designer';

-- Restrict tag creation to staff.
drop policy if exists "Authenticated users can create tags" on public.hub_tags;
drop policy if exists "Staff can create tags" on public.hub_tags;

create policy "Staff can create tags"
on public.hub_tags
for insert
with check (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('curator', 'admin')
  )
);

-- Restrict resource-tag linking/unlinking to staff.
drop policy if exists "Authenticated users can tag their resources." on public.hub_resource_tags;
drop policy if exists "Authenticated users can link tags" on public.hub_resource_tags;
drop policy if exists "Authenticated users can unlink tags" on public.hub_resource_tags;
drop policy if exists "Staff can link resource tags" on public.hub_resource_tags;
drop policy if exists "Staff can unlink resource tags" on public.hub_resource_tags;

create policy "Staff can link resource tags"
on public.hub_resource_tags
for insert
with check (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('curator', 'admin')
  )
);

create policy "Staff can unlink resource tags"
on public.hub_resource_tags
for delete
using (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('curator', 'admin')
  )
);

-- Ensure a public bucket exists for curated resource thumbnails.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hub_thumbnails',
  'hub_thumbnails',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Remove older hub_thumbnails mutation policies (any name), then recreate
-- strict staff-only policies bound to resource-thumbnails/ folder prefix.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
      and (
        coalesce(qual, '') like '%hub_thumbnails%'
        or coalesce(with_check, '') like '%hub_thumbnails%'
      )
  loop
    execute format('drop policy if exists %I on storage.objects', policy_record.policyname);
  end loop;
end
$$;

drop policy if exists "Hub thumbnails are publicly readable" on storage.objects;
drop policy if exists "Staff can upload hub thumbnails" on storage.objects;
drop policy if exists "Staff can update hub thumbnails" on storage.objects;
drop policy if exists "Staff can delete hub thumbnails" on storage.objects;

create policy "Hub thumbnails are publicly readable"
on storage.objects
for select
using (bucket_id = 'hub_thumbnails');

create policy "Staff can upload hub thumbnails"
on storage.objects
for insert
with check (
  bucket_id = 'hub_thumbnails'
  and split_part(name, '/', 1) = 'resource-thumbnails'
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('curator', 'admin')
  )
);

create policy "Staff can update hub thumbnails"
on storage.objects
for update
using (
  bucket_id = 'hub_thumbnails'
  and split_part(name, '/', 1) = 'resource-thumbnails'
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('curator', 'admin')
  )
)
with check (
  bucket_id = 'hub_thumbnails'
  and split_part(name, '/', 1) = 'resource-thumbnails'
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('curator', 'admin')
  )
);

create policy "Staff can delete hub thumbnails"
on storage.objects
for delete
using (
  bucket_id = 'hub_thumbnails'
  and split_part(name, '/', 1) = 'resource-thumbnails'
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('curator', 'admin')
  )
);
