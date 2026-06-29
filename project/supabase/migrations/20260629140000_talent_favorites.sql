-- Client "shortlist": a logged-in user can favorite talents to compare/hire later.
CREATE TABLE IF NOT EXISTS talent_favorites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  talent_id  uuid NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, talent_id)
);
CREATE INDEX IF NOT EXISTS idx_talent_favorites_user ON talent_favorites(user_id);

-- Reached only through the service-role API (/api/favorites), which authenticates
-- the caller from their Supabase token. Enable RLS with no policies so the anon /
-- authenticated keys can't touch it directly; the service role bypasses RLS.
ALTER TABLE talent_favorites ENABLE ROW LEVEL SECURITY;
