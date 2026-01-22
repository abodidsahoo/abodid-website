-- Create the second_brain_club table
CREATE TABLE IF NOT EXISTS second_brain_club (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE second_brain_club ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public signups (INSERT)
CREATE POLICY "Allow public signups" 
ON second_brain_club 
FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);
