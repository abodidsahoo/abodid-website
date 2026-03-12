-- Insert the Gesture Photo Stack research project into Supabase.
-- Run this after the Astro routes are deployed so the project card resolves correctly.

INSERT INTO research (
    title,
    description,
    slug,
    cover_image,
    tags,
    published,
    visible,
    sort_order
)
VALUES (
    'Gesture Photo Stack',
    'A research prototype for browsing photographs like a physical stack through cursor movement, hand tracking, pinch-based resizing, and optional voice input.',
    'gesture-image-preview',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=1200',
    ARRAY['Hand Tracking', 'Interaction Design', 'Research Prototype'],
    true,
    true,
    6
)
ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    cover_image = EXCLUDED.cover_image,
    tags = EXCLUDED.tags,
    published = EXCLUDED.published,
    visible = EXCLUDED.visible,
    sort_order = EXCLUDED.sort_order;

SELECT id, title, slug, visible, sort_order
FROM research
WHERE slug = 'gesture-image-preview';
