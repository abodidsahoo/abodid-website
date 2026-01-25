-- Allow Admins AND Curators to view all resources (including pending)
-- First drop the old restrictive policy if it exists (or we can just replace/create new one with a different name to be safe and avoid conflicts during dev)
-- Best practice: Drop old, create new.

DROP POLICY IF EXISTS "Curators can view all resources." ON public.hub_resources;
DROP POLICY IF EXISTS "Curators can update all resources." ON public.hub_resources;

-- New View Policy
CREATE POLICY "Staff can view all resources." ON public.hub_resources
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND (role = 'curator' OR role = 'admin')
    )
  );

-- New Update Policy
CREATE POLICY "Staff can update all resources." ON public.hub_resources
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND (role = 'curator' OR role = 'admin')
    )
  );
