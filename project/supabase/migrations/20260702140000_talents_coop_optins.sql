/*
  # Cooperation opt-ins on the LIVE talent profile (talents)

  The application form already captures coop_* on talent_applications, but the
  live, self-editable profile (talents) had no place to store them — so a talent
  couldn't later change their mind in the /talent self-service editor, and casting
  couldn't filter by "who is open to AI clone / data collection / directing".

  Mirrors the talent_applications coop flags onto talents. expected_rates (JSONB)
  already exists on talents (migration 20260223100000) — reused, not re-added.

  All additive + idempotent. Defaults match the application form:
  accept_jobs defaults true (a talent is here to take jobs); everything else
  is opt-IN (false) — nothing is assumed without the talent saying yes.
*/

ALTER TABLE talents ADD COLUMN IF NOT EXISTS coop_accept_jobs     boolean NOT NULL DEFAULT true;
ALTER TABLE talents ADD COLUMN IF NOT EXISTS coop_open_buyout     boolean NOT NULL DEFAULT false;
ALTER TABLE talents ADD COLUMN IF NOT EXISTS coop_ai_clone        boolean NOT NULL DEFAULT false;
ALTER TABLE talents ADD COLUMN IF NOT EXISTS coop_ai_training     boolean NOT NULL DEFAULT false;
ALTER TABLE talents ADD COLUMN IF NOT EXISTS coop_proofread       boolean NOT NULL DEFAULT false;
ALTER TABLE talents ADD COLUMN IF NOT EXISTS coop_voice_director  boolean NOT NULL DEFAULT false;
ALTER TABLE talents ADD COLUMN IF NOT EXISTS low_price_data_optin boolean NOT NULL DEFAULT false;

notify pgrst, 'reload schema';
