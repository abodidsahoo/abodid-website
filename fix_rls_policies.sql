-- ==============================================================================
-- FIX RLS POLICIES (Safe to run multiple times)
-- This script ensures the correct permissions are set for Admin to view/edit metadata
-- and upload images.
-- ==============================================================================

-- 1. Metadata Table Policies
-- Enable RLS (if not already enabled)
ALTER TABLE public.page_metadata ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts if re-running
DROP POLICY IF EXISTS "Allow authenticated full access on page_metadata" ON public.page_metadata;
DROP POLICY IF EXISTS "Allow public read on active metadata" ON public.page_metadata;

-- Create Admin Access Policy
CREATE POLICY "Allow authenticated full access on page_metadata" ON public.page_metadata
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- Create Public Read Policy
CREATE POLICY "Allow public read on active metadata" ON public.page_metadata
FOR SELECT TO anon
USING (is_active = true);


-- 2. Storage Bucket Policies
-- (We need to allow uploads to the buckets we created)

-- Drop existing storage policies to clean up
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;

-- Create Admin Upload Policy
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK ( bucket_id IN ('page-assets', 'photography', 'films', 'blog', 'research') );

-- Create Admin Update Policy
CREATE POLICY "Allow authenticated updates" ON storage.objects
FOR UPDATE TO authenticated
USING ( bucket_id IN ('page-assets', 'photography', 'films', 'blog', 'research') );

-- Create Admin Delete Policy
CREATE POLICY "Allow authenticated deletes" ON storage.objects
FOR DELETE TO authenticated
USING ( bucket_id IN ('page-assets', 'photography', 'films', 'blog', 'research') );

-- Create Public Read Policy (for everyone to see images)
CREATE POLICY "Allow public read" ON storage.objects
FOR SELECT TO public
USING ( bucket_id IN ('page-assets', 'photography', 'films', 'blog', 'research') );
