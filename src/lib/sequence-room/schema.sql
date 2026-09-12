-- Supabase SQL Schema for Sequence Room Platform
-- Run this migration in Supabase SQL editor if table does not already exist

CREATE TABLE IF NOT EXISTS public.user_sequence_room_boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled Board',
    backdrop_color TEXT NOT NULL DEFAULT '#14225d',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_sequence_room_boards ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only manage their own boards
CREATE POLICY "Users can view their own sequence rooms"
    ON public.user_sequence_room_boards FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sequence rooms"
    ON public.user_sequence_room_boards FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sequence rooms"
    ON public.user_sequence_room_boards FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sequence rooms"
    ON public.user_sequence_room_boards FOR DELETE
    USING (auth.uid() = user_id);

-- Storage bucket for user uploaded board images
INSERT INTO storage.buckets (id, name, public)
VALUES ('sequence-room-uploads', 'sequence-room-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Public read, authenticated users can insert and update their own uploads
CREATE POLICY "Public read for sequence-room uploads"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'sequence-room-uploads');

CREATE POLICY "Authenticated users can upload sequence-room images"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'sequence-room-uploads' AND
        auth.role() = 'authenticated'
    );

CREATE POLICY "Users can delete their own sequence-room uploads"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'sequence-room-uploads' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );
