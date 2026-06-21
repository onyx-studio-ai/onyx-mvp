-- Human liveness verification (admin-selective, backend-only status).
--
-- Purpose: confirm a roster talent is a real human whose LIVE voice matches the
-- demo they submitted — an anti-AI-impersonation check for the human database.
-- The talent records 1-2 short, language-matched sentences live in the browser
-- (no file upload allowed), and an admin confirms by ear against their demo.
--
-- Deliberately SEPARATE and lighter than the AI-Twin Voice ID flow (which carries
-- the full Talent Engagement Agreement). Status is internal only — never shown on
-- the public roster, because the roster is human by definition.

alter table public.talents
  add column if not exists liveness_status text not null default 'none', -- none | sent | submitted | verified | rejected
  add column if not exists liveness_sentence text,            -- the prompt shown (audit trail)
  add column if not exists liveness_lang text,                -- which language pool was used
  add column if not exists liveness_recording_path text,      -- path in the private 'liveness' bucket
  add column if not exists liveness_sent_at timestamptz,
  add column if not exists liveness_submitted_at timestamptz,
  add column if not exists liveness_reviewed_at timestamptz;

-- Private bucket for the liveness clips. Admin-only access via short-lived signed
-- URLs generated server-side with the service role; never public.
insert into storage.buckets (id, name, public)
values ('liveness', 'liveness', false)
on conflict (id) do nothing;
