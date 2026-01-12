-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. STORIES (Portfolio Projects)
create table public.stories (
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
create table public.photos (
  id uuid default uuid_generate_v4() primary key,
  story_id uuid references public.stories(id) on delete cascade not null,
  url text not null,
  caption text,
  sort_order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. FILMS (Video/Cinematography)
create table public.films (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  video_url text, -- Vimeo/YouTube link
  thumbnail_url text,
  year text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  published boolean default false
);

-- 4. POSTS (Blog/Journal)
create table public.posts (
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
create table public.comments (
  id uuid default uuid_generate_v4() primary key,
  story_id uuid references public.stories(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
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
-- Allow public read access (this is a portfolio site)
alter table public.stories enable row level security;
alter table public.photos enable row level security;
alter table public.films enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;

create policy "Public stories are viewable by everyone" on public.stories for select using (true);
create policy "Public photos are viewable by everyone" on public.photos for select using (true);
create policy "Public films are viewable by everyone" on public.films for select using (true);
create policy "Public posts are viewable by everyone" on public.posts for select using (true);
create policy "Public comments are viewable by everyone" on public.comments for select using (is_approved = true);

-- Allow anyone to Insert comments (Public submission)
create policy "Anyone can insert comments" on public.comments for insert with check (true);

-- Insert Mock Data (for testing)
insert into public.stories (slug, title, intro, category, cover_image, published) values
('urban-silence', 'Urban Silence', 'A visual exploration of the quiet moments in a bustling city.', 'Photography', 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000', true),
('neon-nights', 'Neon Nights', 'Cyberpunk vibes in the rainy streets.', 'Photography', 'https://images.unsplash.com/photo-1555680202-c86f0e12f086', true);

insert into public.posts (slug, title, excerpt, content, published_at, published) values
('welcome', 'Welcome to my Digital Garden', 'Why I built this site with Astro and Supabase.', '# Hello World\n\nThis is my first post.', now(), true);
