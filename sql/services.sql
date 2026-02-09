-- Drop table if it exists
DROP TABLE IF EXISTS public.services;

-- Create services table
CREATE TABLE IF NOT EXISTS public.services (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    category TEXT NOT NULL, -- 'offer', 'skills', 'tools'
    title TEXT, -- For specific items or sub-headers if needed
    content TEXT, -- JSON string or simple text depending on structure
    items JSONB, -- Storing list items as JSON array for flexibility
    sort_order INTEGER DEFAULT 0,
    published BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Policy
CREATE POLICY "Enable read access for all users" ON public.services
    FOR SELECT USING (published = true);

-- Seed Data
INSERT INTO public.services (category, title, content, items, sort_order)
VALUES 
    -- 1. WHAT I HAVE TO OFFER
    (
        'offer',
        'What I have to offer',
        'Comprehensive creative services bridging design, technology, and storytelling.',
        '[
            "Commissioned visual storytelling for brands, editorials, and projects.",
            "Visual narratives for publications and digital media.",
            "Brand identity and campaign photography.",
            "Intimate and honest captures of human depth (Portrait).",
            "Immersive physical and digital exhibition spaces.",
            "UX Design and Prototyping for novel interactions."
        ]'::jsonb,
        10
    ),

    -- 2. MAJOR SKILLS SETS
    (
        'skills',
        'Creative & Research',
        null,
        '[
            "Photography (portrait, documentary, product, events)",
            "Visual analysis",
            "Image annotation & descriptive writing",
            "Lighting",
            "Video Editing",
            "Metacognitive Communication",
            "Teaching"
        ]'::jsonb,
        20
    ),

    -- 3. TECHNICAL TOOLS
    (
        'tools',
        'Technical Toolkit',
        null,
        '[
            "Lightroom",
            "Photoshop",
            "Illustrator",
            "Premiere Pro",
            "DaVinci Resolve",
            "DSLR & mirrorless systems",
            "Colour grading",
            "Retouching",
            "HTML/CSS (working)",
            "Generative AI workflows (Midjourney, Veo)"
        ]'::jsonb,
        30
    );
