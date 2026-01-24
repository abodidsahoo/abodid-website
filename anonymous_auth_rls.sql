-- Anonymous Auth RLS Policy Updates
-- Run this in Supabase SQL Editor to allow anonymous users to bookmark and upvote

-- Step 1: Update bookmarks policy to allow anonymous users
DROP POLICY IF EXISTS "Users can manage own bookmarks" ON hub_resource_bookmarks;

CREATE POLICY "Users and anonymous can manage own bookmarks"
ON hub_resource_bookmarks
FOR ALL
USING (
  auth.uid() = user_id
);

-- Step 2: Update upvotes policy to allow anonymous users
DROP POLICY IF EXISTS "Users can manage own upvotes" ON hub_resource_upvotes;

CREATE POLICY "Users and anonymous can manage own upvotes"
ON hub_resource_upvotes
FOR ALL
USING (
  auth.uid() = user_id
);

-- Step 3: (Optional) Prevent anonymous users from submitting resources
-- This ensures only real accounts can submit
DROP POLICY IF EXISTS "Prevent anonymous submissions" ON hub_resources;

CREATE POLICY "Prevent anonymous submissions"
ON hub_resources
FOR INSERT
WITH CHECK (
  COALESCE((auth.jwt()->>'is_anonymous')::boolean, false) = false
);

-- Step 4: Verification
-- Check that policies are updated
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('hub_resource_bookmarks', 'hub_resource_upvotes', 'hub_resources')
ORDER BY tablename, policyname;
