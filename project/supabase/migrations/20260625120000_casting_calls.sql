/*
  # Casting calls — human-VO audition flow (Phase: 發案 + 試音 + 邀請)

  Extends the existing managed-marketplace tables for ADMIN-posted casting calls
  (a game/project that needs auditions), distinct from client /hire briefs:
    - briefs.kind = 'casting' marks an admin casting call.
    - Roles, an online-only audition script (no download), client reference
      materials (links + files re-hosted on our storage), recording logistics.
    - quotes gain the audition response fields (audio is the existing sample_url,
      plus the talent's self-intro + their own revision policy).
    - casting_invites: a capability-token invite so a known VO can audition via a
      magic link WITHOUT full onboarding (frictionless guest auditioner).
    - talents gain saved presets (default intro + revision policy) so auditioning
      is one-tap.

  This is the HUMAN-VO track only. AI voice licensing stays on its own Voice-ID
  track (separate consent + comp) and is untouched here.

  Additive + idempotent.
*/

-- ── casting fields on briefs ────────────────────────────────────────────────
ALTER TABLE marketplace_briefs
  ADD COLUMN IF NOT EXISTS kind              TEXT NOT NULL DEFAULT 'brief',   -- 'brief' (client) | 'casting' (admin)
  ADD COLUMN IF NOT EXISTS title             TEXT,
  ADD COLUMN IF NOT EXISTS roles             JSONB NOT NULL DEFAULT '[]',     -- [{name,gender,age,personality,emotion,sample_line,is_lead}]
  ADD COLUMN IF NOT EXISTS audition_script   TEXT,                            -- sample lines / direction, shown view-only (no download)
  ADD COLUMN IF NOT EXISTS reference_links   TEXT[] NOT NULL DEFAULT '{}',    -- client reference URLs (kept as-is)
  ADD COLUMN IF NOT EXISTS reference_files   JSONB NOT NULL DEFAULT '[]',     -- [{name,url}] re-hosted on our storage
  ADD COLUMN IF NOT EXISTS recording_start   TEXT,                            -- expected recording start
  ADD COLUMN IF NOT EXISTS recording_methods TEXT[] NOT NULL DEFAULT '{}',    -- home | studio | online
  ADD COLUMN IF NOT EXISTS rate_note         TEXT,                            -- e.g. '¥65/句,含1次修改'
  ADD COLUMN IF NOT EXISTS base_revisions    INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS audition_deadline TEXT;                            -- (also added by an earlier migration; IF NOT EXISTS is a no-op then)
CREATE INDEX IF NOT EXISTS idx_mbriefs_kind ON marketplace_briefs(kind);

-- ── audition-response fields on quotes ──────────────────────────────────────
-- sample_url (existing) = the uploaded audition audio.
ALTER TABLE marketplace_quotes
  ADD COLUMN IF NOT EXISTS intro                TEXT,   -- talent self-intro / proposal
  ADD COLUMN IF NOT EXISTS included_revisions   INT,    -- talent's own revision policy
  ADD COLUMN IF NOT EXISTS extra_revision_price TEXT,
  ADD COLUMN IF NOT EXISTS invite_id            UUID;   -- set when the response came via a guest invite

-- ── talent presets (one-tap auditioning) ────────────────────────────────────
ALTER TABLE talents
  ADD COLUMN IF NOT EXISTS default_intro           TEXT,
  ADD COLUMN IF NOT EXISTS default_revision_policy JSONB;  -- {included:int, extra_price:text}

-- ── guest invites (frictionless audition via magic link) ────────────────────
CREATE TABLE IF NOT EXISTS casting_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id    UUID NOT NULL REFERENCES marketplace_briefs(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  name        TEXT,
  token       TEXT NOT NULL UNIQUE,            -- capability token in the magic link
  talent_id   UUID REFERENCES talents(id) ON DELETE SET NULL,  -- linked if/when they become a talent
  status      TEXT NOT NULL DEFAULT 'invited', -- invited | opened | responded
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_cinvites_brief ON casting_invites(brief_id);
CREATE INDEX IF NOT EXISTS idx_cinvites_email ON casting_invites(lower(email));
ALTER TABLE casting_invites ENABLE ROW LEVEL SECURITY;
-- only the API (service_role) touches invites; token is validated server-side.
CREATE POLICY "svc_full_cinvites" ON casting_invites FOR ALL USING (true) WITH CHECK (true);

-- ── storage bucket for casting reference files + audition uploads ────────────
-- public read (paths are unguessable uuids); writes go through service_role API.
INSERT INTO storage.buckets (id, name, public)
VALUES ('casting', 'casting', true)
ON CONFLICT (id) DO NOTHING;
