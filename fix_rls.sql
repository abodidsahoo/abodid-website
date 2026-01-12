-- FIX RLS POLICIES (Allow Admin to Edit)

-- 1. STORIES
create policy "Authenticated users can insert stories" on public.stories for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update stories" on public.stories for update using (auth.role() = 'authenticated');
create policy "Authenticated users can delete stories" on public.stories for delete using (auth.role() = 'authenticated');

-- 2. PHOTOS
create policy "Authenticated users can insert photos" on public.photos for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update photos" on public.photos for update using (auth.role() = 'authenticated');
create policy "Authenticated users can delete photos" on public.photos for delete using (auth.role() = 'authenticated');

-- 3. FILMS
create policy "Authenticated users can insert films" on public.films for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update films" on public.films for update using (auth.role() = 'authenticated');
create policy "Authenticated users can delete films" on public.films for delete using (auth.role() = 'authenticated');

-- 4. POSTS
create policy "Authenticated users can insert posts" on public.posts for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update posts" on public.posts for update using (auth.role() = 'authenticated');
create policy "Authenticated users can delete posts" on public.posts for delete using (auth.role() = 'authenticated');

-- 5. PROJECTS
create policy "Authenticated users can insert projects" on public.projects for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update projects" on public.projects for update using (auth.role() = 'authenticated');
create policy "Authenticated users can delete projects" on public.projects for delete using (auth.role() = 'authenticated');

-- 6. COMMENTS (Admins can Manage)
create policy "Authenticated users can update comments" on public.comments for update using (auth.role() = 'authenticated');
create policy "Authenticated users can delete comments" on public.comments for delete using (auth.role() = 'authenticated');
