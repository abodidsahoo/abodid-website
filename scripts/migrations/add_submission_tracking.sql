-- Add submission tracking columns to hub_resources table

-- Add submitted_by to track who submitted the resource
ALTER TABLE hub_resources
ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id);

-- Add status column for approval workflow
ALTER TABLE hub_resources
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved' 
    CHECK (status IN ('pending', 'approved', 'rejected'));

-- Add review tracking
ALTER TABLE hub_resources
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE hub_resources
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id);

ALTER TABLE hub_resources
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_hub_resources_submitted_by ON hub_resources(submitted_by);
CREATE INDEX IF NOT EXISTS idx_hub_resources_status ON hub_resources(status);

-- Update existing resources to have 'approved' status
UPDATE hub_resources SET status = 'approved' WHERE status IS NULL;

COMMENT ON COLUMN hub_resources.submitted_by IS 'User who submitted this resource';
COMMENT ON COLUMN hub_resources.status IS 'Approval status: pending, approved, or rejected';
COMMENT ON COLUMN hub_resources.reviewed_at IS 'When the resource was reviewed by an admin';
COMMENT ON COLUMN hub_resources.reviewed_by IS 'Admin who reviewed the resource';
COMMENT ON COLUMN hub_resources.rejection_reason IS 'Reason for rejection (if rejected)';
