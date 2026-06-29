-- Fiverr-style reviews: multi-dimension sub-ratings (1-5 each) on top of the
-- overall `rating`. For a client→talent review: communication / quality / delivery;
-- for a talent→client review the UI relabels (communication / clear brief / prompt
-- payment) but reuses the same columns. Double-blind reveal is computed at read
-- time from created_at + whether both sides reviewed (no schema change needed).
ALTER TABLE marketplace_reviews
  ADD COLUMN IF NOT EXISTS rating_communication int,
  ADD COLUMN IF NOT EXISTS rating_quality       int,
  ADD COLUMN IF NOT EXISTS rating_delivery      int;
