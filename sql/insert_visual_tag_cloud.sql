-- SQL to insert Visual Tag Cloud Generator into the research table
-- Run this in your Supabase SQL Editor

INSERT INTO research (
    title,
    description,
    slug,
    published,
    visible,
    sort_order,
    tags,
    cover_image
) VALUES (
    'Visual Tag Cloud Generator',
    'A physics-based exploration of knowledge taxonomy. Move your cursor to generate tags from my Obsidian vault—watch them spawn, float, and fade as you navigate the space.',
    'visual-tag-cloud',
    true,
    true,
    7, -- Adjust sort_order as needed (lower numbers appear first)
    ARRAY['Interactive', 'Knowledge Graph', 'Obsidian', 'Creative Coding'],
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&q=80&w=1000' -- Tag cloud visualization image
);

-- Verify the insertion
SELECT * FROM research WHERE slug = 'visual-tag-cloud';
