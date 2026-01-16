-- Create media_mentions table only if it doesn't already exist
CREATE TABLE IF NOT EXISTS media_mentions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    title TEXT NOT NULL,
    publication TEXT, -- e.g., "TechCrunch", "New York Times"
    url TEXT NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    categories TEXT[] DEFAULT '{}', -- e.g., ["Press", "Interview", "Mention"]
    image_url TEXT, -- Thumbnail or logo
    published BOOLEAN DEFAULT true
);

-- Enable Row Level Security
ALTER TABLE media_mentions ENABLE ROW LEVEL SECURITY;

-- Drop existing policy to facilitate cleanly recreating it (avoids "policy already exists" error)
DROP POLICY IF EXISTS "Public Read Access" ON media_mentions;

-- Create Policy for Public Read Access
CREATE POLICY "Public Read Access" ON media_mentions FOR SELECT USING (published = true);

-- Insert dummy data only if the table is empty (to avoid duplicates on re-run)
INSERT INTO media_mentions (title, publication, url, categories, published_at)
SELECT 'Interview on Future of AI', 'TechDaily', 'https://example.com/interview', ARRAY['Interview', 'AI'], NOW() - INTERVAL '2 days'
WHERE NOT EXISTS (SELECT 1 FROM media_mentions LIMIT 1);

INSERT INTO media_mentions (title, publication, url, categories, published_at)
SELECT 'Top 10 Developers to Watch', 'DevMag', 'https://example.com/list', ARRAY['Mention', 'Press'], NOW() - INTERVAL '5 days'
WHERE NOT EXISTS (SELECT 1 FROM media_mentions LIMIT 1);
