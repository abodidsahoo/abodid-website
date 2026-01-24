-- Stage 4: Admin User Management

-- 1. Updates to Profiles Table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT true;
-- We default approved to true so existing users aren't locked out immediately.
-- Admin can toggle it to false later.

-- 2. Create index on role for faster filtering
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles (role);

-- 3. Policy updates (if needed)
-- Admin should be able to update anyone. Standard users only update themselves.
-- Current policy: "Users can update own profile" is likely:
-- CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- We need a policy for Admins to update ANY profile.
-- Since we don't have a strict "is_admin" function yet, we can rely on role check.
-- BUT, RLS policies on 'profiles' refer to auth.uid().

CREATE POLICY "Admins can update all profiles" ON public.profiles
FOR UPDATE
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
-- Note: This requires recursion check if not careful.
-- Safer: Define an 'is_admin()' function.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-do policy safely
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "Admins can update all profiles" ON public.profiles
FOR UPDATE
USING (public.is_admin());

-- Verify Policy:
-- "Users can update own profile" exists?
-- If so, RLS is OR-based, so either own-check OR admin-check will pass.

-- 4. Sync Email helper (Optional trigger, or we just do it in code)
-- Doing it in code (upsert) is flexible.
