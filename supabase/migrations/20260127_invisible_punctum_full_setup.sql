-- INVISIBLE PUNCTUM: FULL PROJECT MIGRATION
-- Use this migration to set up the dedicated backend infrastructure for the project.

-- 1. SETUP STORAGE BUCKET
-- Note: 'storage.buckets' is a system table. We insert into it to create a bucket.
insert into storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
values (
    'invisible-punctum-assets', 
    'invisible-punctum-assets', 
    true, 
    false, 
    10485760, -- 10MB limit
    '{image/*, audio/*, video/*}'
)
on conflict (id) do update set public = true;

-- 2. SETUP STORAGE POLICIES (RLS)
-- Allow Public Read
create policy "Public Access"
on storage.objects for select
to public
using ( bucket_id = 'invisible-punctum-assets' );

-- Allow Anon Uploads (For Audio Inputs) -> Be careful with this in production!
create policy "Anon Uploads"
on storage.objects for insert
to anon, authenticated
with check ( bucket_id = 'invisible-punctum-assets' );


-- 3. SETUP IMAGES TABLE (Dedicated Source)
create table if not exists public.invisible_punctum_images (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    title text,
    image_url text not null, -- Can point to the bucket or external
    active boolean default true,
    metadata jsonb default '{}'::jsonb
);

-- Enable RLS
alter table public.invisible_punctum_images enable row level security;

-- Policies for Images
create policy "Public Read Images"
on public.invisible_punctum_images for select
to anon, authenticated
using (active = true);


-- 4. SETUP FEEDBACK TABLE (Enhanced)
create table if not exists public.photo_feedback (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    
    -- Context
    image_url text not null,
    project_id text default 'invisible-punctum',
    
    -- User Data
    user_id uuid references auth.users(id), -- Optional
    name text, -- Optional name
    
    -- Content
    feeling_text text,     -- The written punctum
    audio_url text,        -- The spoken punctum (URL to storage)
    audio_path text,       -- Internal storage path
    audio_duration_ms int, -- Duration for UI playback
    audio_mime text,       -- Mime type (e.g. audio/webm)
    
    -- Constraints
    constraint check_content check (feeling_text is not null or audio_url is not null)
);

-- Indexing
create index if not exists idx_photo_feedback_project on public.photo_feedback(project_id);
create index if not exists idx_photo_feedback_img on public.photo_feedback(image_url);

-- RLS for Feedback
alter table public.photo_feedback enable row level security;

create policy "Anon Insert Feedback"
on public.photo_feedback for insert
to anon, authenticated
with check (true);

create policy "Public Read Feedback"
on public.photo_feedback for select
to anon, authenticated
using (true);

-- 5. SEED INITIAL IMAGES (Optional - From existing data)
-- You can run a script to copy from 'photography' to 'invisible_punctum_images' if desired.
-- insert into public.invisible_punctum_images (image_url, title)
-- select url, title from public.photography limit 10;
