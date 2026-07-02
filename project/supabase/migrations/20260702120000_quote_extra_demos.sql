-- Casting "more demos" flow: when a client (or Onyx, on an admin-posted case) wants
-- to hear a talent's other tones / game-character samples, we ask the talent to
-- upload EXTRA demos onto their audition — appended, not replacing sample_url.
--   extra_samples          : [{ url, label, created_at }]  (added by the talent)
--   more_demos_note         : the direction/ask ("多給幾個不同語氣的遊戲角色")
--   more_demos_requested_at : set when requested, cleared when the talent uploads
ALTER TABLE marketplace_quotes
  ADD COLUMN IF NOT EXISTS extra_samples jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS more_demos_note text,
  ADD COLUMN IF NOT EXISTS more_demos_requested_at timestamptz;
