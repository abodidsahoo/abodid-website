-- Create the research_projects table
CREATE TABLE IF NOT EXISTS research_projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    slug TEXT UNIQUE NOT NULL,
    href TEXT NOT NULL,
    image TEXT,
    tags TEXT[], -- Array of text for tags
    featured BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0
);

-- Policy for reading (public)
ALTER TABLE research_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON research_projects
    FOR SELECT USING (true);

-- Insert the 4 main projects
-- Using ON CONFLICT (slug) DO UPDATE to ensure we can re-run this script to update data
INSERT INTO research_projects (title, description, slug, href, image, tags, featured, sort_order)
VALUES
    (
        'The Second Brain',
        'My personal Obsidian vault, a digital garden of interconnected thoughts, notes, and research.',
        'obsidian-vault',
        '/research/obsidian-vault',
        'https://images.unsplash.com/photo-1555421689-d68471e189f2?auto=format&fit=crop&q=80&w=1000',
        ARRAY['Knowledge Graph', 'Obsidian', 'Second Brain'],
        true,
        1
    ),
    (
        'Invisible Punctums',
        'An AI-driven exploration of human memory, data, and the gaps in our digital archives.',
        'invisible-punctum',
        '/research/invisible-punctum',
        'https://images.unsplash.com/photo-1620641788421-7f1368d12355?auto=format&fit=crop&q=80&w=1000',
        ARRAY['AI', 'Memory', 'Data Vis'],
        true,
        2
    ),
    (
        'Do ghosts feel jealous if you miss the living ones more than them?',
        'Blurring the lines between the living and the dead, this project was a way to decode my minute emotional gestures around the dissonance between absence and presence.',
        'do-ghosts-feel-jealous',
        '/research/do-ghosts-feel-jealous',
        'https://images.unsplash.com/photo-1516575334481-f85287c2c81d?auto=format&fit=crop&q=80&w=1000',
        ARRAY['Photography', 'Writing', 'Performance', 'Film'],
        true,
        3
    ),
    (
        'Visual Experiments',
        'A playground for creative coding, motion design, AR/VR, and 3D web experiences.',
        'visual-experiments',
        '/visual-experiments',
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=1000',
        ARRAY['Creative Coding', 'Three.js', 'Visual Lab'],
        true,
        4
    )
ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    href = EXCLUDED.href,
    image = EXCLUDED.image,
    tags = EXCLUDED.tags,
    featured = EXCLUDED.featured,
    sort_order = EXCLUDED.sort_order;
