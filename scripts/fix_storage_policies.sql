-- 1. Allow Public Read Access
create policy "Public Access" on storage.objects for select using ( bucket_id = 'portfolio-assets' );

-- 2. Allow Authenticated Insert (Upload)
create policy "Authenticated Upload" on storage.objects for insert with check ( bucket_id = 'portfolio-assets' and auth.role() = 'authenticated' );

-- 3. Allow Authenticated Update (Manage)
create policy "Authenticated Manage" on storage.objects for update using ( bucket_id = 'portfolio-assets' and auth.role() = 'authenticated' );

-- 4. Allow Authenticated Delete
create policy "Authenticated Delete" on storage.objects for delete using ( bucket_id = 'portfolio-assets' and auth.role() = 'authenticated' );

