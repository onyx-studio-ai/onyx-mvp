/*
  # Marketplace Phase 3c — briefs + quotes (managed model)

  Clients post a voice-over brief (TTS is NOT bid here — it goes through Onyx
  directly). Active talents see open briefs and submit a quote. Onyx mediates
  the award (managed marketplace — Bunny Studio / Voices-Managed pattern), so
  there is no open client-facing auction in v1.

  Money modelling follows the marketplace norm (Fiverr / Voices.com): store the
  GROSS amount the client pays + the commission rate; the talent's NET take-home
  is a derived (generated) column — never the source of truth — and net is what
  we display to the talent. Commission defaults to 0.20 (the rate talents agreed
  to in the onboarding terms). NOTE: there is a known inconsistency — the
  talent_earnings module comments 25% for platform orders. Left configurable per
  row; owner to reconcile the canonical rate.

  Additive + idempotent. The number generator is deletion/concurrency-safe
  (MAX(suffix)+1 + per-day advisory lock), same pattern as the fixed
  application_number/order_number generators.
*/

-- ── briefs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_briefs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_number    TEXT UNIQUE,
  client_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_email    TEXT NOT NULL,
  client_name     TEXT,
  company         TEXT,
  categories      TEXT[] NOT NULL DEFAULT '{}',      -- VO use-case types (canonical English)
  language        TEXT,
  length          TEXT,
  budget          TEXT,
  deadline        TEXT,
  brief           TEXT NOT NULL,                      -- the requirement description
  locale          TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'open',       -- open | reviewing | awarded | closed | cancelled
  awarded_quote_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mbriefs_status  ON marketplace_briefs(status);
CREATE INDEX IF NOT EXISTS idx_mbriefs_created ON marketplace_briefs(created_at DESC);

ALTER TABLE marketplace_briefs ENABLE ROW LEVEL SECURITY;
-- service_role (API routes) full access; public /hire form may insert.
CREATE POLICY "svc_full_briefs"   ON marketplace_briefs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_insert_briefs" ON marketplace_briefs FOR INSERT TO anon WITH CHECK (true);

-- ── quotes ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_quotes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id        UUID NOT NULL REFERENCES marketplace_briefs(id) ON DELETE CASCADE,
  talent_id       UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  gross_amount    NUMERIC NOT NULL CHECK (gross_amount > 0),         -- what the client pays
  commission_rate NUMERIC NOT NULL DEFAULT 0.20 CHECK (commission_rate >= 0 AND commission_rate < 1),
  net_amount      NUMERIC GENERATED ALWAYS AS (round(gross_amount * (1 - commission_rate), 2)) STORED,  -- talent take-home (displayed)
  currency        TEXT NOT NULL DEFAULT 'USD',
  message         TEXT,
  sample_url      TEXT,
  status          TEXT NOT NULL DEFAULT 'submitted',  -- submitted | shortlisted | accepted | rejected | withdrawn
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mquotes_brief  ON marketplace_quotes(brief_id);
CREATE INDEX IF NOT EXISTS idx_mquotes_talent ON marketplace_quotes(talent_id);
-- at most one live quote per (brief, talent)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_quote
  ON marketplace_quotes(brief_id, talent_id)
  WHERE status IN ('submitted', 'shortlisted');

ALTER TABLE marketplace_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "svc_full_quotes" ON marketplace_quotes FOR ALL USING (true) WITH CHECK (true);

-- ── brief number generator (BRF-YYYYMMDD-NNNN) ──────────────────────────────
CREATE OR REPLACE FUNCTION generate_brief_number()
RETURNS TRIGGER AS $$
DECLARE date_str text; seq_num integer;
BEGIN
  date_str := to_char(now(), 'YYYYMMDD');
  PERFORM pg_advisory_xact_lock(hashtext('mbrief_number_' || date_str));
  SELECT COALESCE(MAX(split_part(brief_number, '-', 3)::int), 0) + 1
  INTO seq_num FROM marketplace_briefs
  WHERE brief_number LIKE 'BRF-' || date_str || '-%';
  NEW.brief_number := 'BRF-' || date_str || '-' || LPAD(seq_num::text, 4, '0');
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_brief_number ON marketplace_briefs;
CREATE TRIGGER trg_brief_number BEFORE INSERT ON marketplace_briefs
  FOR EACH ROW WHEN (NEW.brief_number IS NULL)
  EXECUTE FUNCTION generate_brief_number();
