/*
  # Casting per-role auditions + per-role cap

  Game/drama casting calls have many roles. A talent auditions PER ROLE (one
  upload per role, can do several roles), and each role has a cap (default 5).
  When a role is full, it greys out — but the raw count is NEVER shown to
  talents (we only nudge "try another role"). Pricing stays on the quote
  (talent writes their own terms freely — per line / per case / per hour /
  "min to accept"), so we reuse marketplace_quotes + a role_name rather than a
  separate table.

  Additive + idempotent.
*/

ALTER TABLE marketplace_quotes ADD COLUMN IF NOT EXISTS role_name TEXT;
ALTER TABLE marketplace_briefs  ADD COLUMN IF NOT EXISTS audition_cap INT NOT NULL DEFAULT 5;

-- One live quote per (brief, talent, ROLE) — lets a talent audition several
-- roles of the same casting call, but only once per role. (Was per brief+talent.)
DROP INDEX IF EXISTS uniq_active_quote;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_quote_role
  ON marketplace_quotes (brief_id, talent_id, COALESCE(role_name, ''))
  WHERE status IN ('submitted', 'shortlisted');
