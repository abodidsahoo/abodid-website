-- Add rejection_reason column to hub_resources table
-- This column stores the reason why a resource was rejected by a curator/admin

ALTER TABLE hub_resources 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN hub_resources.rejection_reason IS 'Reason provided by curator/admin when rejecting a submission';
