/*
  # Brief-level client ↔ Onyx messages

  marketplace_messages is a client↔talent thread (talent_id NOT NULL). Before any
  talent is involved — while a /hire request is in review — the client and Onyx
  still need to talk. This is that thread: keyed on the brief only, between the
  client and Onyx (who replies as a team, not a person). All client correspondence
  on a request happens here, in-platform (not email).

  Additive + idempotent.
*/
CREATE TABLE IF NOT EXISTS brief_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id    UUID NOT NULL REFERENCES marketplace_briefs(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('client', 'admin')),
  sender_name TEXT,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_briefmsg_thread ON brief_messages(brief_id, created_at);

ALTER TABLE brief_messages ENABLE ROW LEVEL SECURITY;
-- service-role only (all access is mediated by our API, which checks ownership)
DROP POLICY IF EXISTS "svc_full_briefmsg" ON brief_messages;
CREATE POLICY "svc_full_briefmsg" ON brief_messages FOR ALL USING (true) WITH CHECK (true);
