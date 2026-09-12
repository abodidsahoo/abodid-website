-- Supabase SQL Schema for Photo Board Platform
-- Run this migration in Supabase SQL editor if table does not already exist

CREATE TABLE IF NOT EXISTS public.user_photo_boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled Board',
    backdrop_color TEXT NOT NULL DEFAULT '#14225d',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_photo_boards ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only manage their own boards
CREATE POLICY "Users can view their own photo boards"
    ON public.user_photo_boards FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own photo boards"
    ON public.user_photo_boards FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own photo boards"
    ON public.user_photo_boards FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own photo boards"
    ON public.user_photo_boards FOR DELETE
    USING (auth.uid() = user_id);

-- Storage bucket for user uploaded board images
INSERT INTO storage.buckets (id, name, public)
VALUES ('photoboard-uploads', 'photoboard-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Public read, authenticated users can insert and update their own uploads
CREATE POLICY "Public read for photoboard uploads"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'photoboard-uploads');

CREATE POLICY "Authenticated users can upload photoboard images"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'photoboard-uploads' AND
        auth.role() = 'authenticated'
    );

CREATE POLICY "Users can delete their own photoboard uploads"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'photoboard-uploads' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );
