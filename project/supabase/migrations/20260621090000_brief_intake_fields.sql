/*
  # Richer brief intake fields (marketplace_briefs)

  The /hire form now separates "what it is" (content_type, single-select) from
  "where it plays" (media_scope) and captures the pricing-critical license terms
  (license_term, territory) plus script status, a reference-audio link, and a
  singing flag. content_type replaces the old multi-select `categories` going
  forward (categories kept for backward-compat / matching).

  Additive + idempotent.
*/
ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS content_type   text;
ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS media_scope    text;
ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS territory      text;
ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS license_term   text;
ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS script_status  text;
ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS ref_audio_url  text;
ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS has_singing    boolean NOT NULL DEFAULT false;
