-- Stage 3: Community Signals & Trust

-- 1. Update Profiles Table
-- Add bio, details
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS bio text,
ADD COLUMN IF NOT EXISTS website text,
ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '[]'::jsonb;

-- 2. Update Hub Resources Table
-- Add stats columns for performance (we will use triggers to keep them in sync, or just increment in code)
-- For simplicity and sorting performance, storage is better.
ALTER TABLE public.hub_resources
ADD COLUMN IF NOT EXISTS upvotes_count integer DEFAULT 0;

-- 3. Bookmarks (Saved Resources)
CREATE TABLE IF NOT EXISTS public.hub_resource_bookmarks (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  resource_id uuid REFERENCES public.hub_resources(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, resource_id)
);

-- RLS for Bookmarks
ALTER TABLE public.hub_resource_bookmarks ENABLE ROW LEVEL SECURITY;

-- Users can view their own bookmarks
CREATE POLICY "Users can view own bookmarks" ON public.hub_resource_bookmarks
  FOR SELECT USING (auth.uid() = user_id);

-- Public can view bookmarks (if we want public profiles to show "Saved")
-- The requirement: "Show submitted gems + saved gems" on profile.
CREATE POLICY "Public can view bookmarks" ON public.hub_resource_bookmarks
  FOR SELECT USING (true); 

-- Users can insert their own bookmarks
CREATE POLICY "Users can insert own bookmarks" ON public.hub_resource_bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own bookmarks
CREATE POLICY "Users can delete own bookmarks" ON public.hub_resource_bookmarks
  FOR DELETE USING (auth.uid() = user_id);


-- 4. Upvotes
CREATE TABLE IF NOT EXISTS public.hub_resource_upvotes (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  resource_id uuid REFERENCES public.hub_resources(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, resource_id)
);

-- RLS for Upvotes
ALTER TABLE public.hub_resource_upvotes ENABLE ROW LEVEL SECURITY;

-- Public can view upvotes
CREATE POLICY "Public can view upvotes" ON public.hub_resource_upvotes
  FOR SELECT USING (true);

-- Authenticated users can vote
CREATE POLICY "Users can insert own upvotes" ON public.hub_resource_upvotes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can remove vote
CREATE POLICY "Users can delete own upvotes" ON public.hub_resource_upvotes
  FOR DELETE USING (auth.uid() = user_id);


-- 5. Triggers for Upvote Count (Optional but recommended for consistency)
CREATE OR REPLACE FUNCTION public.handle_new_upvote()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.hub_resources
  SET upvotes_count = upvotes_count + 1
  WHERE id = NEW.resource_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_deleted_upvote()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.hub_resources
  SET upvotes_count = upvotes_count - 1
  WHERE id = OLD.resource_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_upvote ON public.hub_resource_upvotes;
CREATE TRIGGER on_auth_upvote
  AFTER INSERT ON public.hub_resource_upvotes
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_upvote();

DROP TRIGGER IF EXISTS on_auth_downvote ON public.hub_resource_upvotes;
CREATE TRIGGER on_auth_downvote
  AFTER DELETE ON public.hub_resource_upvotes
  FOR EACH ROW EXECUTE PROCEDURE public.handle_deleted_upvote();

-- 6. Grant permissions (just in case)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_resource_bookmarks TO authenticated;
GRANT SELECT ON public.hub_resource_bookmarks TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_resource_upvotes TO authenticated;
GRANT SELECT ON public.hub_resource_upvotes TO anon;

GRANT SELECT ON public.profiles TO anon, authenticated;
