-- Allow only Admins to DELETE resources (Permanent Delete)
DROP POLICY IF EXISTS "Admins can delete resources." ON public.hub_resources;

CREATE POLICY "Admins can delete resources." ON public.hub_resources
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );
