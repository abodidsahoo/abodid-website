-- FIX: Use unique names for the policies to avoid "already exists" error

-- 1. Allow public viewing (Rename to "Newsletter Public Access")
create policy "Newsletter Public Access" on storage.objects 
  for select using ( bucket_id = 'newsletter-assets' );

-- 2. Allow YOU (admin) to upload (Rename to "Newsletter Auth Upload")
create policy "Newsletter Auth Upload" on storage.objects 
  for insert with check ( 
    bucket_id = 'newsletter-assets' 
    and auth.role() = 'authenticated' 
  );
