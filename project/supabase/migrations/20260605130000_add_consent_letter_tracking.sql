/*
  # Add Talent Consent Letter version tracking

  ## Background
  Onyx Talent Consent Letter v2 (drafted 2026-06-05 — see
  `~/Desktop/Onyx_Legal_Review_2026-06-05/03_Talent_Consent_Letter_v2.md`)
  needs per-talent tracking of:
    1. WHEN they signed the letter
    2. WHICH version of the letter they signed (template versioning
       so we know who's on v1 vs v2 vs future versions)
    3. WHERE the signed PDF is stored (e.g., DocuSign URL or
       Supabase storage bucket URL)

  This is required for:
    - Audit trail (if a dispute arises, prove what they agreed to)
    - GDPR Article 7 / PIPL Article 14 — proof of consent
    - Re-signing flow when Consent Letter template is updated
    - Compliance reporting (e.g., "show me all talents who haven't
      re-signed since the v2 release")

  ## Changes to `talents` table
  - consent_letter_signed_at (timestamptz, nullable) — when the
    talent signed the most recent Consent Letter. NULL means never
    signed (legacy talents from before this system).
  - consent_letter_pdf_url (text, nullable) — URL of the signed PDF
    (DocuSign envelope URL, HelloSign download URL, or Supabase
    storage bucket path).
  - consent_letter_version (text, nullable) — template version
    string, e.g., 'v1.0-2026-06-05' or 'v2.0-2026-06-05'. Allows
    tracking which version of the legal template each talent agreed
    to, so we can re-issue when the template updates.

  ## Note
  This migration is AUTHORED but NOT APPLIED until the v2 Talent
  Consent Letter is signed off by the lawyer + DocuSign integration
  is built. To apply later:
    supabase db push
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'talents'
      AND column_name = 'consent_letter_signed_at'
  ) THEN
    ALTER TABLE talents
      ADD COLUMN consent_letter_signed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'talents'
      AND column_name = 'consent_letter_pdf_url'
  ) THEN
    ALTER TABLE talents
      ADD COLUMN consent_letter_pdf_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'talents'
      AND column_name = 'consent_letter_version'
  ) THEN
    ALTER TABLE talents
      ADD COLUMN consent_letter_version text;
  END IF;
END $$;

-- Index for compliance queries: "show me all talents who haven't
-- signed since version X" — common admin operation.
CREATE INDEX IF NOT EXISTS idx_talents_consent_letter_version
  ON talents(consent_letter_version)
  WHERE consent_letter_version IS NOT NULL;
