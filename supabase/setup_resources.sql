-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- 1. PROFILES (Extends auth.users)
-- Note: You might already have a profiles table. If so, alter it to add these columns if missing.
-- This script assumes strict separation for the 'hub' module, but ideally integrates with existing profiles.
-- We will create a 'profiles' table if it doesn't exist.

create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade not null primary key,
  username text unique,
  full_name text,
  avatar_url text,
  website text,
  role text default 'user' check (role in ('user', 'curator', 'admin')),
  updated_at timestamp with time zone,
  
  constraint username_length check (char_length(username) >= 3)
);

-- Ensure 'role' column exists if the table already existed but without it
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'role') then
    alter table public.profiles add column role text default 'user' check (role in ('user', 'curator', 'admin'));
  end if;
end
$$;

-- Trigger to create profile on signup (typical Supabase pattern)
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

-- Check if trigger exists to avoid duplication error on re-run
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute procedure public.handle_new_user();
  end if;
end
$$;


-- 2. HUB TAGS
create table if not exists public.hub_tags (
  id uuid default uuid_generate_v4() primary key,
  name text unique not null
);

-- 3. HUB RESOURCES
create table if not exists public.hub_resources (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  title text not null,
  description text,
  url text not null,
  
  submitted_by uuid references public.profiles(id) on delete set null,
  
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  
  audience text check (audience in ('Designer', 'Artist', 'Filmmaker', 'Creative Technologist', 'Other')),
  
  thumbnail_url text,
  credit_text text, -- e.g. "Recommended by @someone"
  
  admin_notes text, -- Internal notes by admin
  reviewed_at timestamp with time zone,
  reviewed_by uuid references public.profiles(id)
);

-- 4. JUNCTION: RESOURCE_TAGS
create table if not exists public.hub_resource_tags (
  resource_id uuid references public.hub_resources(id) on delete cascade,
  tag_id uuid references public.hub_tags(id) on delete cascade,
  primary key (resource_id, tag_id)
);

-- 5. ENABLE RLS
alter table public.profiles enable row level security;
alter table public.hub_tags enable row level security;
alter table public.hub_resources enable row level security;
alter table public.hub_resource_tags enable row level security;

-- 6. POLICIES

-- PROFILES
-- Public read
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Public profiles are viewable by everyone.' and tablename = 'profiles'
  ) then
    create policy "Public profiles are viewable by everyone." on public.profiles
      for select using (true);
  end if;
end
$$;

-- User update own
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Users can update own profile.' and tablename = 'profiles'
  ) then
    create policy "Users can update own profile." on public.profiles
      for update using (auth.uid() = id);
  end if;
end
$$;

-- HUB_TAGS
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Tags are viewable by everyone.' and tablename = 'hub_tags'
  ) then
    create policy "Tags are viewable by everyone." on public.hub_tags
      for select using (true);
  end if;
end
$$;

-- HUB_RESOURCES
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Anyone can view approved resources.' and tablename = 'hub_resources'
  ) then
    create policy "Anyone can view approved resources." on public.hub_resources
      for select using (status = 'approved');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Users can view own submissions.' and tablename = 'hub_resources'
  ) then
    create policy "Users can view own submissions." on public.hub_resources
      for select using (auth.uid() = submitted_by);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Admins can view all resources.' and tablename = 'hub_resources'
  ) then
    create policy "Admins can view all resources." on public.hub_resources
      for select using (
        exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Authenticated users can submit resources.' and tablename = 'hub_resources'
  ) then
    create policy "Authenticated users can submit resources." on public.hub_resources
      for insert with check (auth.role() = 'authenticated'); 
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Users can update own pending resources.' and tablename = 'hub_resources'
  ) then
    create policy "Users can update own pending resources." on public.hub_resources
      for update using (auth.uid() = submitted_by and status = 'pending');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Admins can update all resources.' and tablename = 'hub_resources'
  ) then
    create policy "Admins can update all resources." on public.hub_resources
      for update using (
        exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
      );
  end if;
end
$$;

-- HUB_RESOURCE_TAGS
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Resource tags are viewable by everyone.' and tablename = 'hub_resource_tags'
  ) then
    create policy "Resource tags are viewable by everyone." on public.hub_resource_tags
      for select using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Authenticated users can tag their resources.' and tablename = 'hub_resource_tags'
  ) then
    create policy "Authenticated users can tag their resources." on public.hub_resource_tags
      for insert with check (
        exists (
           select 1 from public.hub_resources 
           where id = resource_id 
           and submitted_by = auth.uid()
        )
      );
  end if;
end
$$;

-- STORAGE BUCKET POLICIES (If you create a bucket named 'hub_thumbnails')
-- We can create the bucket directly via SQL if the extensions are enabled
insert into storage.buckets (id, name, public)
values ('hub_thumbnails', 'hub_thumbnails', true)
on conflict (id) do nothing;

-- NOW SET THE STORAGE POLICIES
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

-- 7. SEED DATA (Tags)
insert into public.hub_tags (name) values 
('Design System'), ('Typography'), ('Color'), ('Inspiration'), ('Tool'), ('Article')
on conflict (name) do nothing;
