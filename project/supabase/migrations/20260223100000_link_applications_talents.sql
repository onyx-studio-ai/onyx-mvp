-- Link Applications <-> Talents with bidirectional references
-- Add application_id to talents (nullable for manually created talents)
ALTER TABLE talents ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES talent_applications(id);

-- Add talent_id to talent_applications (nullable, set after auto-creation)
ALTER TABLE talent_applications ADD COLUMN IF NOT EXISTS talent_id UUID REFERENCES talents(id);

-- Add fields to carry over from applications
ALTER TABLE talents ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE talents ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE talents ADD COLUMN IF NOT EXISTS expected_rates JSONB;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_talents_application_id ON talents(application_id);
CREATE INDEX IF NOT EXISTS idx_applications_talent_id ON talent_applications(talent_id);
