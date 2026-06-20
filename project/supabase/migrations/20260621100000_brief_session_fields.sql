/*
  # Brief: audition deadline + voice direction / live-session options

  Two deadlines matter (industry norm, e.g. Voices.com): an audition/demo
  deadline and the final delivery deadline. The existing `deadline` column is
  the DELIVERY deadline; add `audition_deadline` for the audition one. Also
  capture whether the client wants a voice director and/or a live-directed
  online recording session (a priced add-on that affects scheduling + quote).

  Additive + idempotent.
*/
ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS audition_deadline   text;
ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS wants_director      boolean NOT NULL DEFAULT false;
ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS wants_live_session  boolean NOT NULL DEFAULT false;
