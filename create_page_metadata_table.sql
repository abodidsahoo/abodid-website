-- Create page_metadata table for managing SEO metadata
CREATE TABLE IF NOT EXISTS public.page_metadata (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    page_path VARCHAR(255) UNIQUE NOT NULL,
    page_title VARCHAR(255) NOT NULL,
    meta_title VARCHAR(255),
    meta_description TEXT,
    og_image_url TEXT,
    og_type VARCHAR(50) DEFAULT 'website',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Add some default entries for major pages
INSERT INTO public.page_metadata (page_path, page_title, meta_title, meta_description) VALUES
('/', 'Home', 'Abodid Sahoo', 'Photographer, Researcher, and Creative Technologist exploring the intersection of images, code, and culture through research, photography, and interactive media.'),
('/about', 'About', 'About | Abodid Sahoo', 'Learn about my 8+ years journey across art, design, research, and creative technology. From photography to AI research, exploring visual culture and computational creativity.'),
('/photography', 'Photography', 'Photography | Abodid Sahoo', 'A curated collection of my photographic work spanning travel, fashion, documentary, and experimental photography.'),
('/blog', 'Blog', 'Blog | Abodid Sahoo', 'Thoughts on photography, technology, culture, and creative research. Essays and reflections on art, design, and computational creativity.'),
('/research', 'Research', 'Research | Abodid Sahoo', 'Academic research exploring AI bias, visual culture, and computational photography. Publications, projects, and interactive research experiences.'),
('/press', 'Press', 'Press | Abodid Sahoo', 'Media coverage, interviews, and press mentions featuring my work in photography, research, and creative technology.'),
('/cv', 'CV', 'Curriculum Vitae | Abodid Sahoo', 'Professional experience, education, awards, and achievements across art, design, research, and creative technology.')
ON CONFLICT (page_path) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_page_metadata_path ON public.page_metadata(page_path);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_page_metadata_updated_at BEFORE UPDATE ON public.page_metadata
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
