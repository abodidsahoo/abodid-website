-- Auto-Create Profile Trigger
-- This ensures every new user gets a profile automatically when they sign up
--
-- Run this in Supabase SQL Editor to enable seamless user registration

-- Step 1: Create the function that handles new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert a new profile for the user
  INSERT INTO public.profiles (id, username, full_name, role, avatar_url)
  VALUES (
    NEW.id,
    -- Generate username from email (part before @)
    LOWER(SPLIT_PART(NEW.email, '@', 1)),
    -- Get full name from signup metadata, or use email prefix as fallback
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    -- All new users start as 'user' role
    'user',
    -- Generate a default avatar using DiceBear API (initials-based)
    'https://api.dicebear.com/7.x/initials/svg?seed=' || COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING; -- Prevent duplicate errors
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create the trigger that calls this function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 3: Handle potential username conflicts
-- If the generated username already exists, append a random number
-- This is a more robust version:

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INT := 1;
BEGIN
  -- Generate base username from email
  base_username := LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-z0-9]', '', 'g'));
  final_username := base_username;
  
  -- Check if username exists, if so, append number
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    final_username := base_username || counter;
    counter := counter + 1;
  END LOOP;
  
  -- Insert profile
  INSERT INTO public.profiles (id, username, full_name, role, avatar_url)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    'user',
    'https://api.dicebear.com/7.x/initials/svg?seed=' || COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verification Query (run after setup to confirm trigger is active)
-- SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
