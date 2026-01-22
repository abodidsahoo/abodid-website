-- ============================================
-- FIX: Second Brain Club RLS Policy
-- ============================================
-- This script fixes the Row-Level Security policy error
-- that prevents anonymous users from signing up.

-- Step 1: Drop any existing policies (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public signups" ON second_brain_club;
DROP POLICY IF EXISTS "Allow public to view their own submissions" ON second_brain_club;

-- Step 2: Ensure RLS is enabled
ALTER TABLE second_brain_club ENABLE ROW LEVEL SECURITY;

-- Step 3: Create policy to allow anonymous INSERT operations
-- This allows anyone (anon, authenticated) to insert new signups
CREATE POLICY "Allow public signups" 
ON second_brain_club 
FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

-- Step 4: (Optional) Allow users to SELECT their own data
-- This can be useful for confirmation pages or debugging
CREATE POLICY "Allow public to view their own submissions" 
ON second_brain_club 
FOR SELECT 
TO anon, authenticated 
USING (true);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- After running this script, verify the policies:

-- 1. Check if RLS is enabled
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE tablename = 'second_brain_club';

-- 2. List all policies on the table
-- SELECT * 
-- FROM pg_policies 
-- WHERE tablename = 'second_brain_club';

-- 3. View recent signups (to test SELECT policy)
-- SELECT * FROM second_brain_club ORDER BY created_at DESC LIMIT 5;
