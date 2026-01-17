-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. STORIES (Portfolio Projects)
create table if not exists public.stories (
  id uuid default uuid_generate_v4() primary key,
  slug text not null unique,
  title text not null,
  intro text,
  cover_image text, -- URL
  category text,    -- e.g., 'Photography', 'Travel'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  published boolean default false
);

-- 2. PHOTOS (Images inside a Story)
create table if not exists public.photos (
  id uuid default uuid_generate_v4() primary key,
  story_id uuid references public.stories(id) on delete cascade not null,
  url text not null,
  caption text,
  sort_order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. FILMS (Video/Cinematography)
create table if not exists public.films (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  video_url text, -- Vimeo/YouTube link
  thumbnail_url text,
  year text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  published boolean default false
);

-- 4. BLOG (Posts)
create table if not exists public.blog (
  id uuid default uuid_generate_v4() primary key,
  slug text not null unique,
  title text not null,
  excerpt text,
  content text, -- Markdown content
  cover_image text,
  published_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  published boolean default false
);

-- 5. COMMENTS (Unified for Stories and Posts)
create table if not exists public.comments (
  id uuid default uuid_generate_v4() primary key,
  story_id uuid references public.stories(id) on delete cascade,
  post_id uuid references public.blog(id) on delete cascade,
  author_name text not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  is_approved boolean default false, -- For moderation
  constraint comment_target_check check (
    (story_id is not null and post_id is null) or
    (story_id is null and post_id is not null)
  )
);

-- Row Level Security (RLS)
-- Note: Re-running these lines might show "policy already exists" errors. This is safe to ignore.
alter table public.stories enable row level security;
alter table public.photos enable row level security;
alter table public.films enable row level security;
alter table public.blog enable row level security;
alter table public.comments enable row level security;

-- Policies (Drop first to avoid errors on re-run, or ignore errors)
drop policy if exists "Public stories are viewable by everyone" on public.stories;
create policy "Public stories are viewable by everyone" on public.stories for select using (true);

drop policy if exists "Public photos are viewable by everyone" on public.photos;
create policy "Public photos are viewable by everyone" on public.photos for select using (true);

drop policy if exists "Public films are viewable by everyone" on public.films;
create policy "Public films are viewable by everyone" on public.films for select using (true);

drop policy if exists "Public posts are viewable by everyone" on public.blog;
create policy "Public posts are viewable by everyone" on public.blog for select using (true);

drop policy if exists "Public comments are viewable by everyone" on public.comments;
create policy "Public comments are viewable by everyone" on public.comments for select using (is_approved = true);

drop policy if exists "Anyone can insert comments" on public.comments;
create policy "Anyone can insert comments" on public.comments for insert with check (true);

-- 6. STORAGE (Buckets)
insert into storage.buckets (id, name, public)
values ('portfolio-assets', 'portfolio-assets', true)
on conflict (id) do nothing;

-- Storage Policies
drop policy if exists "Public Access" on storage.objects;
create policy "Public Access" on storage.objects for select using ( bucket_id = 'portfolio-assets' );

drop policy if exists "Authenticated Upload" on storage.objects;
create policy "Authenticated Upload" on storage.objects for insert with check ( bucket_id = 'portfolio-assets' and auth.role() = 'authenticated' );
  
drop policy if exists "Authenticated Manage" on storage.objects;
create policy "Authenticated Manage" on storage.objects for update using ( bucket_id = 'portfolio-assets' and auth.role() = 'authenticated' );

drop policy if exists "Authenticated Delete" on storage.objects;
create policy "Authenticated Delete" on storage.objects for delete using ( bucket_id = 'portfolio-assets' and auth.role() = 'authenticated' );

-- Insert Mock Data (Safe to re-run)
insert into public.stories (slug, title, intro, category, cover_image, published) values
('urban-silence', 'Urban Silence', 'A visual exploration of the quiet moments in a bustling city.', 'Photography', 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000', true),
('neon-nights', 'Neon Nights', 'Cyberpunk vibes in the rainy streets.', 'Photography', 'https://images.unsplash.com/photo-1555680202-c86f0e12f086', true)
on conflict (slug) do nothing;

insert into public.blog (slug, title, excerpt, content, published_at, published) values
('welcome', 'Welcome to my Digital Garden', 'Why I built this site with Astro and Supabase.', '# Hello World\n\nThis is my first post.', now(), true)
on conflict (slug) do nothing;

-- Expansion: Guestbook, Subscribers, Inquiries

-- 1. Guestbook (The Wall)
create table if not exists public.guestbook_entries (
  id uuid default uuid_generate_v4() primary key,
  author_name text not null,
  author_email text, -- Private, optional
  content text not null,
  is_approved boolean default false, -- Approval queue
  is_featured boolean default false, -- Key entries
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Subscribers (Newsletter)
create table if not exists public.subscribers (
  id uuid default uuid_generate_v4() primary key,
  email text not null unique,
  status text default 'active', -- active, unsubscribed
  source text default 'footer',
  subscribed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Inquiries (Services/Workshops)
create table if not exists public.inquiries (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  email text not null,
  type text not null, -- workshop, service, general
  message text,
  status text default 'new', -- new, replied, closed
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies

-- Guestbook
alter table public.guestbook_entries enable row level security;

-- Public can VIEW approved entries
create policy "Public view approved guestbook" on public.guestbook_entries
  for select using (is_approved = true);

-- Public can INSERT entries (Submission)
create policy "Public insert guestbook" on public.guestbook_entries
  for insert with check (true);

-- Only Authenticated (Admin) can UPDATE/DELETE (Moderation)
create policy "Admin manage guestbook" on public.guestbook_entries
  for all using (auth.role() = 'authenticated');
  
  
-- Subscribers
alter table public.subscribers enable row level security;

-- Public can INSERT (Subscribe)
create policy "Public insert subscribers" on public.subscribers
  for insert with check (true);

-- Only Admin can SELECT (Read List)
create policy "Admin view subscribers" on public.subscribers
  for select using (auth.role() = 'authenticated');


-- Inquiries
alter table public.inquiries enable row level security;

-- Public can INSERT (Contact Form)
create policy "Public insert inquiries" on public.inquiries
  for insert with check (true);

-- Only Admin can SELECT/MANAGE
create policy "Admin manage inquiries" on public.inquiries
  for all using (auth.role() = 'authenticated');
