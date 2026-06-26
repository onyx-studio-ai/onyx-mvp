/*
  # /hire client-brief intake fields

  The "find a voice / post a brief" form is being professionalised. New intake
  columns on marketplace_briefs (language / accent / length already exist):

  - voices_needed       (int)  — how many voices the project needs (1, 2, 3+)
  - gender_needs        (text) — gender composition, e.g. "1 男 1 女" / "不限"
  - script_text         (text) — the client's pasted script (audition or final)
  - script_file_url     (text) — OR an uploaded script file (public URL)
  - script_type         (text) — 'audition' | 'final' — which kind of script above
  - local_studio_region (text) — requested local recording-studio region
                                  (台灣 / 中國大陸 / 美國 …); non-empty = requested.
                                  A value-add request, fulfilled only where Onyx has
                                  a studio partner in that region.

  The legacy `script_status` column is left in place (no longer collected by the
  form) for back-compat. Additive + idempotent.
*/
ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS voices_needed       int;
ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS gender_needs        text;
ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS script_text         text;
ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS script_file_url     text;
ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS script_type         text;
ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS local_studio_region text;
