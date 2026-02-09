-- Drop table if it exists to reset schema (for local dev/prototyping)
DROP TABLE IF EXISTS public.work_experience;

-- Create the work_experience table with category
CREATE TABLE IF NOT EXISTS public.work_experience (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    role TEXT NOT NULL,
    company TEXT NOT NULL,
    duration TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'work', -- 'work', 'education', 'award', 'conference'
    sort_order INTEGER DEFAULT 0,
    published BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.work_experience ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Enable read access for all users" ON public.work_experience
    FOR SELECT USING (published = true);

-- Insert seed data with specific user-provided content
INSERT INTO public.work_experience (role, company, duration, description, category, sort_order)
VALUES 
    -- WORK EXPERIENCE
    (
        'Exhibition Experience Designer',
        'Royal College of Art',
        '2023 - 2025',
        'Designed immersive physical and digital exhibition spaces for degree shows. Led the spatial planning and visitor journey for over 500 exhibits.',
        'work',
        10
    ),
    (
        'Lead Photographer',
        'Royal College of Art',
        '2023 - 2025',
        'Documented high-end and creative venues including the British Film Institute, Ollama, London, Frameless, RCA Graduate shows, International Body of Art, and Flat Time House.',
        'work',
        20
    ),
    (
        'Creative Producer, Director, and Editor',
        'Multiple Brands & MNCs',
        '2017 - 2021',
        'Produced content for select clients including Hermosa Art Design Studio, Wieden+Kennedy, Budweiser, Jawa Motorcycles, Pursuit of Portraits (New York), Uniqlo, and Odisha Tourism.',
        'work',
        30
    ),
    (
        'Founder and Creative Director',
        'Visual Notes Creative Agency (India)',
        '2014 - 2017',
        'Led a creative agency focused on UX design, promotional content, photography, brand films, and logo design. Shutdown operations in 2017 upon relocating to Mumbai.',
        'work',
        40
    ),

    -- EDUCATION
    (
        'MA Information Experience Design',
        'Royal College of Art',
        '2023 – 2025',
        'Exploring the intersection of data, design, and narrative. Focused on creating immersive installations and experimental interfaces that challenge traditional modes of information consumption.',
        'education',
        10
    ),
    (
        'Master of Design',
        'National Institute of Design',
        '2019 - 2021',
        'Specialized in New Media Design. Developed a strong foundation in interaction design, creative coding, and user experience, culminating in projects that bridge physical and digital realms.',
        'education',
        20
    ),
    (
        'Bachelor of Arts',
        'University of Creative Arts',
        '2015 - 2018',
        'Major in Film Making. Gained comprehensive experience in visual storytelling, cinematography, and post-production, laying the groundwork for a multidisciplinary creative practice.',
        'education',
        30
    ),

    -- AWARDS & CONFERENCES (Conferences category will be grouped under Awards in UI)
    (
        'Apple Scholarship',
        'Royal College of Art',
        '2022',
        'Awarded a full scholarship covering the entire tuition fees of £20,000 for the MA program at the Royal College of Art.',
        'award',
        10
    ),
    (
        'BSA Conference 2026',
        'University of Manchester',
        '2026',
        'Selected to present two papers at the British Sociological Association conference.',
        'conference',
        20
    ),
    (
        'Cambridge Data School',
        'Cambridge University',
        '2026',
        'Participant in the Cambridge Data School program.',
        'conference',
        30
    ),
     (
        'J N Tata Endowment Loan Scholarship',
        'J N Tata Endowment',
        '2023',
        'Merit-based loan scholarship for higher education abroad.',
        'award',
        40
    )
;
