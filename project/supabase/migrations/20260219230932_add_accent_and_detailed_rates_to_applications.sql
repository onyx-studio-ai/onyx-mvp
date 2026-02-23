/*
  # Add Accent and Detailed Rate Fields to Talent Applications

  ## Summary
  Adds accent field and expands the rates section to support role-specific pricing breakdowns.

  ## Changes to talent_applications

  ### New Columns
  - `accent` (text) — free-text accent description (e.g. "Taiwanese Mandarin", "Lisbon Portuguese")
  - `rate_tts_hourly` (numeric) — VO: hourly rate for TTS dataset work (USD)
  - `rate_micro_gig` (numeric) — VO: minimum rate for micro-gig / 1-3 sentence patch (USD)
  - `rate_lead_vocal` (numeric) — Singer: rate for a full lead vocal track (USD)
  - `rate_hook_chorus` (numeric) — Singer: rate for a short hook/chorus (USD)

  ## Notes
  - All rate fields are optional (nullable)
  - Existing rate fields (expected_rate_voice, expected_rate_music) are retained for backwards compatibility
  - Default currency changed context to USD on the form side only; DB stores whatever is submitted
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'talent_applications' AND column_name = 'accent'
  ) THEN
    ALTER TABLE talent_applications ADD COLUMN accent text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'talent_applications' AND column_name = 'rate_tts_hourly'
  ) THEN
    ALTER TABLE talent_applications ADD COLUMN rate_tts_hourly numeric DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'talent_applications' AND column_name = 'rate_micro_gig'
  ) THEN
    ALTER TABLE talent_applications ADD COLUMN rate_micro_gig numeric DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'talent_applications' AND column_name = 'rate_lead_vocal'
  ) THEN
    ALTER TABLE talent_applications ADD COLUMN rate_lead_vocal numeric DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'talent_applications' AND column_name = 'rate_hook_chorus'
  ) THEN
    ALTER TABLE talent_applications ADD COLUMN rate_hook_chorus numeric DEFAULT NULL;
  END IF;
END $$;
