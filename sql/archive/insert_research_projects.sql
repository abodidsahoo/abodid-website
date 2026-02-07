-- Insert research projects into Supabase
-- This will add 5 key research projects to your CMS

-- Insert only the 5 key research projects
-- These lead to explanation pages first, which then have buttons to launch experiments
INSERT INTO research (title, description, slug, cover_image, tags, published, visible, sort_order)
VALUES
    -- 1. Polaroids Table (at the top - this IS the explanation/experiment combined)
    (
        'Polaroids Table',
        'An interactive photo arrangement experiment—handle photographs like physical objects, sequence them on a digital table, and feel how their order changes meaning. A stepping stone for designing photo books.',
        'polaroids-table',
        'https://images.unsplash.com/photo-1606857521015-7f9fcf423740?auto=format&fit=crop&q=80&w=1000',
        ARRAY['Photography', 'Interaction Design', 'In Progress'],
        true,
        true,
        1
    ),
    
    -- 2. The Second Brain (explanation page exists)
    (
        'The Second Brain',
        'My personal Obsidian vault, a digital garden of interconnected thoughts, notes, and research.',
        'second-brain',
        'https://images.unsplash.com/photo-1456324504439-367cee10123c?auto=format&fit=crop&q=80&w=1000',
        ARRAY['Knowledge Graph', 'Obsidian', 'Second Brain'],
        true,
        true,
        2
    ),
    
    -- 3. Invisible Punctums (explanation page exists)
    (
        'Invisible Punctums',
        'An AI-driven exploration of human memory, data, and the gaps in our digital archives.',
        'invisible-punctum-explanation',
        'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=1000',
        ARRAY['AI', 'Memory', 'Data Vis'],
        true,
        true,
        3
    ),
    
    -- 4. LLM-based Chatbot (this IS the experiment page directly)
    (
        'LLM-based Chatbot',
        'Experimenting with OpenRouter API to build an internal chatbot trained on my research papers and creative work. Using selective free-tier models to create AI-driven tools for analyzing social data.',
        'llm-chatbot',
        'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=1000',
        ARRAY['OpenRouter API', 'AI Tools', 'In Progress'],
        true,
        true,
        4
    ),
    
    -- 5. Do ghosts feel jealous? (explanation page exists with "Go through the body of work" button)
    (
        'Do ghosts feel jealous if you miss the living ones more than them?',
        'Blurring the lines between the living and the dead, this project was a way to decode my minute emotional gestures around the dissonance between absence and presence.',
        'do-ghosts-feel-jealous',
        'https://images.unsplash.com/photo-1516575334481-f85287c2c81d?auto=format&fit=crop&q=80&w=1000',
        ARRAY['Photography', 'Writing', 'Performance', 'Film'],
        true,
        true,
        5
    )

ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    cover_image = EXCLUDED.cover_image,
    tags = EXCLUDED.tags,
    published = EXCLUDED.published,
    visible = EXCLUDED.visible,
    sort_order = EXCLUDED.sort_order;

-- Verify the data was inserted
SELECT id, title, slug, visible, sort_order FROM research ORDER BY sort_order;
