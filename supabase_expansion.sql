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
