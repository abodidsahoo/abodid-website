-- Add 'deleted' to the allowed status values for hub_resources
-- We need to drop the existing constraint and add a new one.

ALTER TABLE public.hub_resources
DROP CONSTRAINT IF EXISTS hub_resources_status_check;

ALTER TABLE public.hub_resources
ADD CONSTRAINT hub_resources_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'deleted'));
