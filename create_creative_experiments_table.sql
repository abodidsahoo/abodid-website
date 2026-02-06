-- Create creative_experiments table for the Creative Experiments page
-- This table will store experimental projects like Darkroom, iCloud Images, etc.

CREATE TABLE IF NOT EXISTS public.creative_experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    bg_image TEXT, -- URL to background image
    href VARCHAR(500) NOT NULL, -- Link to the experiment page
    tags TEXT[], -- Array of tags (e.g., ['3D Web', 'CSS 3D', 'Archive'])
    featured BOOLEAN DEFAULT false, -- Whether to feature this experiment
    display_order INTEGER DEFAULT 0, -- Order in which to display experiments
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.creative_experiments ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access to creative_experiments"
    ON public.creative_experiments
    FOR SELECT
    USING (true);

-- Allow authenticated users with admin role to insert/update/delete
CREATE POLICY "Allow admin to manage creative_experiments"
    ON public.creative_experiments
    FOR ALL
    USING (
        auth.uid() IN (
            SELECT id FROM auth.users WHERE email IN (
                SELECT email FROM public.profiles WHERE role = 'admin'
            )
        )
    );

-- Insert existing iCloud Memory Space experiment
INSERT INTO public.creative_experiments (title, description, bg_image, href, tags, featured, display_order)
VALUES (
    'iCloud Memory Space',
    'A 3D floating archive of 80,000 images, exploring digital memory as a spatial experience.',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=1000',
    '/visual-experiments/icloud-images',
    ARRAY['3D Web', 'CSS 3D', 'Archive'],
    true,
    1
);

-- Insert Darkroom experiment
INSERT INTO public.creative_experiments (title, description, bg_image, href, tags, featured, display_order)
VALUES (
    'Darkroom',
    'An immersive analog photography experience exploring the tactile nature of film development and the intimate process of bringing images to life in darkness.',
    'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?auto=format&fit=crop&q=80&w=1000',
    '/darkroom',
    ARRAY['Photography', 'Analog', 'Process'],
    true,
    2
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_creative_experiments_updated_at
    BEFORE UPDATE ON public.creative_experiments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
