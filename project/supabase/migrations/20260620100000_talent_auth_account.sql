/*
  # Talent self-service accounts (Phase 3)

  Link a talent to a Supabase Auth user so they can log in and edit their own
  profile. The account is created on onboarding completion (server-side, admin
  API); the talent sets a password via a recovery link and logs in at /talent.

  Additive + idempotent.
*/

ALTER TABLE talents ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_talents_auth_user_id ON talents(auth_user_id) WHERE auth_user_id IS NOT NULL;
