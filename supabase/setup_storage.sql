-- Create the bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('hub_thumbnails', 'hub_thumbnails', true)
on conflict (id) do nothing;

-- Policy "Public Access": SELECT for role anon
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Public Access' and tablename = 'objects' and schemaname = 'storage'
  ) then
    create policy "Public Access"
      on storage.objects for select
      using ( bucket_id = 'hub_thumbnails' );
  end if;
end
$$;

-- Policy "Uploader Access": INSERT for role authenticated
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Authenticated Upload' and tablename = 'objects' and schemaname = 'storage'
  ) then
    create policy "Authenticated Upload"
      on storage.objects for insert
      with check ( bucket_id = 'hub_thumbnails' and auth.role() = 'authenticated' ); 
  end if;
end
$$;
