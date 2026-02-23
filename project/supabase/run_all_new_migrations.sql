-- =============================================================================
-- ONYX PLATFORM — 合併 Migration (2026-02-21)
-- 
-- 請在 Supabase Dashboard > SQL Editor 中一次性執行
-- 包含：
--   1. Consent & Voice ID 欄位
--   2. Certificates 表 & Storage
--   3. Voice Orders rights_level 欄位
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 1: talent_applications — 新增 consent 欄位
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'talent_applications' AND column_name = 'consent_moral_rights'
  ) THEN
    ALTER TABLE talent_applications ADD COLUMN consent_moral_rights boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'talent_applications' AND column_name = 'consent_voice_id'
  ) THEN
    ALTER TABLE talent_applications ADD COLUMN consent_voice_id boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'talent_applications' AND column_name = 'vocal_tone'
  ) THEN
    ALTER TABLE talent_applications ADD COLUMN vocal_tone text[] NOT NULL DEFAULT '{}';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 2: talents — Voice ID 欄位
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'talents' AND column_name = 'voice_id_status'
  ) THEN
    ALTER TABLE talents ADD COLUMN voice_id_status text NOT NULL DEFAULT 'none'
      CHECK (voice_id_status IN ('none', 'requested', 'submitted', 'verified'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'talents' AND column_name = 'voice_id_token'
  ) THEN
    ALTER TABLE talents ADD COLUMN voice_id_token text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'talents' AND column_name = 'voice_id_token_expires'
  ) THEN
    ALTER TABLE talents ADD COLUMN voice_id_token_expires timestamptz DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'talents' AND column_name = 'voice_id_file_url'
  ) THEN
    ALTER TABLE talents ADD COLUMN voice_id_file_url text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'talents' AND column_name = 'voice_id_submitted_at'
  ) THEN
    ALTER TABLE talents ADD COLUMN voice_id_submitted_at timestamptz DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'talents' AND column_name = 'voice_id_number'
  ) THEN
    ALTER TABLE talents ADD COLUMN voice_id_number text DEFAULT '';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_talents_voice_id_token ON talents(voice_id_token) WHERE voice_id_token IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 3: voice-affidavits storage bucket
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-affidavits', 'voice-affidavits', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can upload voice affidavits' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Anyone can upload voice affidavits"
      ON storage.objects FOR INSERT TO anon, authenticated
      WITH CHECK (bucket_id = 'voice-affidavits');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can read voice affidavits' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Authenticated users can read voice affidavits"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'voice-affidavits');
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 4: certificates 表
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id text UNIQUE NOT NULL,
  order_id text NOT NULL,
  order_type text NOT NULL CHECK (order_type IN ('voice', 'music', 'orchestra')),
  order_number text NOT NULL,
  client_email text NOT NULL,
  client_name text DEFAULT '',
  project_name text DEFAULT '',
  product_category text NOT NULL DEFAULT '',
  asset_type text NOT NULL DEFAULT '',
  rights_level text NOT NULL DEFAULT 'standard' CHECK (rights_level IN ('standard', 'broadcast', 'global')),
  rights_details jsonb NOT NULL DEFAULT '{}',
  voice_id_ref text DEFAULT '',
  talent_name text DEFAULT '',
  audio_specs text DEFAULT '24-bit/48kHz WAV',
  qr_code_url text DEFAULT '',
  pdf_url text DEFAULT '',
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certificates_order_id ON certificates(order_id);
CREATE INDEX IF NOT EXISTS idx_certificates_order_number ON certificates(order_number);
CREATE INDEX IF NOT EXISTS idx_certificates_license_id ON certificates(license_id);
CREATE INDEX IF NOT EXISTS idx_certificates_client_email ON certificates(client_email);

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can manage certificates' AND tablename = 'certificates'
  ) THEN
    CREATE POLICY "Authenticated users can manage certificates"
      ON certificates FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anon can read certificates by license_id' AND tablename = 'certificates'
  ) THEN
    CREATE POLICY "Anon can read certificates by license_id"
      ON certificates FOR SELECT TO anon
      USING (true);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 5: certificates storage bucket
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('certificates', 'certificates', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read certificates files' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Anyone can read certificates files"
      ON storage.objects FOR SELECT TO anon, authenticated
      USING (bucket_id = 'certificates');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload certificates' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Authenticated users can upload certificates"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'certificates');
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 6: voice_orders — 新增 rights_level 欄位
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voice_orders' AND column_name = 'rights_level'
  ) THEN
    ALTER TABLE voice_orders ADD COLUMN rights_level text NOT NULL DEFAULT 'standard'
      CHECK (rights_level IN ('standard', 'broadcast', 'global'));
  END IF;
END $$;

-- Backfill: 如果之前有 broadcast_rights = true 的訂單，自動標記為 broadcast
UPDATE voice_orders
SET rights_level = 'broadcast'
WHERE broadcast_rights = true AND rights_level = 'standard';

-- =============================================================================
-- TALENT EARNINGS & PAYOUTS TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS talent_earnings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  order_id UUID NOT NULL,
  order_type TEXT NOT NULL CHECK (order_type IN ('voice', 'music')),
  order_number TEXT NOT NULL,
  tier TEXT NOT NULL,
  order_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.10,
  commission_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  payout_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS talent_payouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  method TEXT NOT NULL DEFAULT 'bank_transfer' CHECK (method IN ('bank_transfer', 'paypal', 'wise', 'other')),
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  earnings_count INT NOT NULL DEFAULT 0,
  period_start DATE,
  period_end DATE,
  notes TEXT,
  processed_by TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_talent_earnings_talent ON talent_earnings(talent_id);
CREATE INDEX IF NOT EXISTS idx_talent_earnings_status ON talent_earnings(status);
CREATE INDEX IF NOT EXISTS idx_talent_earnings_order ON talent_earnings(order_id);
CREATE INDEX IF NOT EXISTS idx_talent_payouts_talent ON talent_payouts(talent_id);
CREATE INDEX IF NOT EXISTS idx_talent_payouts_status ON talent_payouts(status);

ALTER TABLE talent_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE talent_payouts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'talent_earnings' AND policyname = 'talent_earnings_service_all'
  ) THEN
    CREATE POLICY talent_earnings_service_all ON talent_earnings FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'talent_payouts' AND policyname = 'talent_payouts_service_all'
  ) THEN
    CREATE POLICY talent_payouts_service_all ON talent_payouts FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 8: talent-assets storage bucket (headshots + demos)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('talent-assets', 'talent-assets', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read talent assets' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Anyone can read talent assets"
      ON storage.objects FOR SELECT TO anon, authenticated
      USING (bucket_id = 'talent-assets');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can upload talent assets' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Anyone can upload talent assets"
      ON storage.objects FOR INSERT TO anon, authenticated
      WITH CHECK (bucket_id = 'talent-assets');
  END IF;
END $$;

-- =============================================================================
-- 完成！所有 migration 已執行
-- =============================================================================
