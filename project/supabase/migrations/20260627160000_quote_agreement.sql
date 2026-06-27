-- Job-agreement (授權書) acceptance per awarded job. The talent must accept the
-- agreement before they can start / upload a delivery (Voices-style). Stored on the
-- quote (the talent's job record); the order links to it via quote_id.
ALTER TABLE marketplace_quotes ADD COLUMN IF NOT EXISTS agreement_accepted_at timestamptz;
