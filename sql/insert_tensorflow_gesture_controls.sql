-- Insert the TensorFlow Gesture Controls research project into Supabase.
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
    'TensorFlow Gesture Controls',
    'A TensorFlow.js version of the gesture photo-stack experiment for testing custom gesture logic, tuning, and future model control.',
    'tensorflow-gesture-controls',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=1200',
    ARRAY['TensorFlow.js', 'Hand Tracking', 'Research Prototype'],
    true,
    true,
    7
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
WHERE slug = 'tensorflow-gesture-controls';
