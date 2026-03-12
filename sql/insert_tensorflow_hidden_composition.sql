-- Insert the TensorFlow Hidden Composition research project into Supabase.
-- Run this after the matching Astro routes are deployed:
--   /research/tensorflow-hidden-composition
--   /research/tensorflow-hidden-composition/launch

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
    'TensorFlow Hidden Composition',
    'A browser-based TensorFlow.js experiment where each photograph begins as a reduced field of color and line, then reveals itself through bodily alignment, gesture matching, and soft photographic disclosure.',
    'tensorflow-hidden-composition',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=1200',
    ARRAY['TensorFlow.js', 'Embodied Interaction', 'Photography', 'Research Prototype'],
    true,
    true,
    8
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
WHERE slug = 'tensorflow-hidden-composition';
