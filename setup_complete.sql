-- MASTER SETUP SCRIPT
-- Run this to create missing tables AND fix permissions.

-- 1. Create PROJECTS Table (Research)
create table if not exists public.projects (
  id uuid default uuid_generate_v4() primary key,
  slug text not null unique,
  title text not null,
  description text,
  content text,
  tags text[],
  link text,
  repo_link text,
  image text,
  sort_order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  published boolean default false
);

-- 2. Update FILMS Table (Add 'role' column if missing)
alter table public.films add column if not exists role text;

-- 3. ENABLE RLS (Security)
alter table public.projects enable row level security;
alter table public.films enable row level security;
alter table public.stories enable row level security;
alter table public.photos enable row level security;
alter table public.posts enable row level security;

-- 4. APPLY ADMIN WRITING PERMISSIONS (The Fix)

-- Projects
drop policy if exists "Authenticated users can insert projects" on public.projects;
create policy "Authenticated users can insert projects" on public.projects for insert with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can update projects" on public.projects;
create policy "Authenticated users can update projects" on public.projects for update using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can delete projects" on public.projects;
create policy "Authenticated users can delete projects" on public.projects for delete using (auth.role() = 'authenticated');

drop policy if exists "Public projects are viewable by everyone" on public.projects;
create policy "Public projects are viewable by everyone" on public.projects for select using (true);

-- Stories
drop policy if exists "Authenticated users can insert stories" on public.stories;
create policy "Authenticated users can insert stories" on public.stories for insert with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can update stories" on public.stories;
create policy "Authenticated users can update stories" on public.stories for update using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can delete stories" on public.stories;
create policy "Authenticated users can delete stories" on public.stories for delete using (auth.role() = 'authenticated');

-- Photos
drop policy if exists "Authenticated users can insert photos" on public.photos;
create policy "Authenticated users can insert photos" on public.photos for insert with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can update photos" on public.photos;
create policy "Authenticated users can update photos" on public.photos for update using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can delete photos" on public.photos;
create policy "Authenticated users can delete photos" on public.photos for delete using (auth.role() = 'authenticated');

-- Films
drop policy if exists "Authenticated users can insert films" on public.films;
create policy "Authenticated users can insert films" on public.films for insert with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can update films" on public.films;
create policy "Authenticated users can update films" on public.films for update using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can delete films" on public.films;
create policy "Authenticated users can delete films" on public.films for delete using (auth.role() = 'authenticated');

-- Posts
drop policy if exists "Authenticated users can insert posts" on public.posts;
create policy "Authenticated users can insert posts" on public.posts for insert with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can update posts" on public.posts;
create policy "Authenticated users can update posts" on public.posts for update using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can delete posts" on public.posts;
create policy "Authenticated users can delete posts" on public.posts for delete using (auth.role() = 'authenticated');

-- Comments
drop policy if exists "Authenticated users can update comments" on public.comments;
create policy "Authenticated users can update comments" on public.comments for update using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can delete comments" on public.comments;
create policy "Authenticated users can delete comments" on public.comments for delete using (auth.role() = 'authenticated');
