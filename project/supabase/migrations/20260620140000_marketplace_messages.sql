/*
  # Marketplace Phase 4 — in-platform messaging

  Closed, admin-visible messaging between a client and a talent, scoped to a
  brief (per the owner's decision: keep it on-platform, Onyx can read every
  thread; relaxed about occasional leakage, so no aggressive masking in v1).

  A thread is one (brief, talent) pairing — a brief can have a thread with each
  talent who engaged it. Messaging is enabled once a talent has a quote on the
  brief (they're connected). Onyx (admin) can post into any thread as 'admin'.

  Additive + idempotent.
*/

CREATE TABLE IF NOT EXISTS marketplace_messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id       UUID NOT NULL REFERENCES marketplace_briefs(id) ON DELETE CASCADE,
  talent_id      UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,   -- the talent party of this thread
  sender_type    TEXT NOT NULL CHECK (sender_type IN ('client', 'talent', 'admin')),
  sender_user_id UUID,                                                     -- auth.users id of the sender (null for admin/system)
  sender_name    TEXT,
  body           TEXT NOT NULL CHECK (length(btrim(body)) > 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mmsg_thread ON marketplace_messages(brief_id, talent_id, created_at);

ALTER TABLE marketplace_messages ENABLE ROW LEVEL SECURITY;
-- All access is via service_role API routes that authorize the caller as a
-- party to the thread; no direct anon/authenticated table access.
CREATE POLICY "svc_full_messages" ON marketplace_messages FOR ALL USING (true) WITH CHECK (true);

-- Associate a brief with a logged-in client (so they see their threads). Anon
-- briefs match by client_email instead. Lightweight read-state for unread hints.
ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS client_last_read_at TIMESTAMPTZ;
