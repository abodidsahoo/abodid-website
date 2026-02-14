-- Dedicated storage bucket for visual moodboard assets.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'moodboard-assets',
    'moodboard-assets',
    true,
    10485760,
    array['image/avif', 'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp']
)
on conflict (id) do update
set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Public read for live moodboard rendering.
drop policy if exists "Moodboard Public Read" on storage.objects;
create policy "Moodboard Public Read"
on storage.objects
for select
using (bucket_id = 'moodboard-assets');

-- Authenticated admin panel users can manage files from browser if needed.
drop policy if exists "Moodboard Auth Upload" on storage.objects;
create policy "Moodboard Auth Upload"
on storage.objects
for insert
with check (bucket_id = 'moodboard-assets' and auth.role() = 'authenticated');

drop policy if exists "Moodboard Auth Update" on storage.objects;
create policy "Moodboard Auth Update"
on storage.objects
for update
using (bucket_id = 'moodboard-assets' and auth.role() = 'authenticated');

drop policy if exists "Moodboard Auth Delete" on storage.objects;
create policy "Moodboard Auth Delete"
on storage.objects
for delete
using (bucket_id = 'moodboard-assets' and auth.role() = 'authenticated');
