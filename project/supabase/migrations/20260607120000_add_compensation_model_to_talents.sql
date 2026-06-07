/*
  # Talent compensation model (commission vs buyout)

  Wing's two-path payout model (2026-06-07 confirmed):

  - **commission** (default): talent earns 25% of each platform AI
    generation sale. Talent supplies their own initial 1 hr at no
    cost; Onyx trains the model; ongoing revenue share.

  - **buyout**: Onyx pays talent a one-off lump sum. Voice becomes
    Onyx's; 100% of future platform revenue from that voice flows
    to Onyx. No ongoing royalty.

  Wing decides per-talent which path applies (not talent self-
  selection — avoids adverse selection where talents who think
  they'll be popular choose commission and the rest choose buyout).

  Default = 'commission' so every existing talent and every new
  applicant lands on the platform standard path. Wing flips the
  flag to 'buyout' from /admin/talents only after she's evaluated
  the voice and decided to invite a buyout deal.

  Idempotent (IF NOT EXISTS guard).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'talents' AND column_name = 'compensation_model'
  ) THEN
    ALTER TABLE talents
      ADD COLUMN compensation_model TEXT NOT NULL DEFAULT 'commission'
      CHECK (compensation_model IN ('commission', 'buyout'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_talents_compensation_model
  ON talents(compensation_model);
