/*
  # Add Consent Fields (Moral Rights & Voice ID) + Voice ID System

  ## Changes to talent_applications
  - consent_moral_rights (boolean) — consent to not assert moral rights
  - consent_voice_id (boolean) — consent to provide Voice ID affidavit
  - vocal_tone (text[]) — singer vocal tone tags (moved from being discarded)

  ## Changes to talents (for approved talents)
  - voice_id_status (text) — 'none' | 'requested' | 'submitted' | 'verified'
  - voice_id_token (text) — secure one-time upload token
  - voice_id_token_expires (timestamptz) — token expiry
  - voice_id_file_url (text) — uploaded Voice ID file URL
  - voice_id_submitted_at (timestamptz)
  - voice_id_number (text) — sequential VID-XXXX identifier

  ## Storage
  - Creates voice-affidavits bucket for Voice ID recordings
*/

-- === talent_applications: new consent columns ===
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

-- === talents: Voice ID fields ===
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

-- Index for token lookups
CREATE INDEX IF NOT EXISTS idx_talents_voice_id_token ON talents(voice_id_token) WHERE voice_id_token IS NOT NULL;

-- === voice-affidavits storage bucket ===
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-affidavits', 'voice-affidavits', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload voice affidavits"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'voice-affidavits');

CREATE POLICY "Authenticated users can read voice affidavits"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'voice-affidavits');
