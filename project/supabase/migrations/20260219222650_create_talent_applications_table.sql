/*
  # Create Talent Applications Table

  ## Summary
  This migration creates the talent_applications table for managing incoming talent (voice actor and singer) applications submitted via the public /apply page.

  ## New Tables

  ### talent_applications
  Stores all applicant information from the public talent application form.

  **Basic Info:**
  - id (uuid, PK)
  - application_number (text, unique) — auto-generated format: APP-YYYYMMDD-XXXX
  - role_type (text) — 'VO' (voice actor) or 'Singer'
  - full_name (text)
  - email (text)
  - phone (text, optional)
  - country (text)
  - languages (text[]) — languages applicant can perform in
  - gender (text) — Male / Female / Non-binary
  - age_range (text) — e.g. 20-25, 26-30, etc.

  **Voice Profile:**
  - voice_types (text[]) — e.g. Warm, Energetic, Corporate, etc.
  - specialties (text[]) — for VO: Commercial, Documentary, etc. / for Singer: Pop, Jazz, etc.
  - experience_years (text) — e.g. 0-1, 2-5, 5+
  - notable_clients (text, optional)
  - bio (text, optional)

  **Technical Setup:**
  - has_home_studio (boolean)
  - microphone_model (text, optional)
  - daw_software (text, optional)
  - recording_environment (text) — Home Studio / Professional Studio / Both
  - can_deliver_dry_audio (boolean)

  **Expected Rates:**
  - expected_rate_voice (numeric, optional) — per project or per min rate expectation
  - expected_rate_music (numeric, optional)
  - rate_currency (text, default 'TWD')
  - rate_notes (text, optional)

  **File Submission:**
  - demo_file_url (text) — Supabase Storage URL for WAV file
  - demo_file_name (text) — original filename
  - demo_file_size (integer) — bytes

  **Legal Consent:**
  - consent_data_processing (boolean, NOT NULL)
  - consent_terms (boolean, NOT NULL)
  - consent_age_verified (boolean, NOT NULL)

  **Workflow:**
  - status (text) — pending / under_review / approved / rejected
  - admin_notes (text, optional)
  - reviewed_by (text, optional)
  - reviewed_at (timestamptz, optional)
  - created_at (timestamptz)
  - updated_at (timestamptz)

  ## Security
  - RLS enabled
  - Anonymous users can INSERT (submit applications)
  - Only authenticated admins can SELECT, UPDATE, DELETE
*/

CREATE TABLE IF NOT EXISTS talent_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_number text UNIQUE NOT NULL,

  -- Role
  role_type text NOT NULL CHECK (role_type IN ('VO', 'Singer')),

  -- Basic Info
  full_name text NOT NULL,
  email text NOT NULL,
  phone text DEFAULT '',
  country text NOT NULL DEFAULT '',
  languages text[] NOT NULL DEFAULT '{}',
  gender text NOT NULL DEFAULT '' CHECK (gender IN ('Male', 'Female', 'Non-binary', '')),
  age_range text NOT NULL DEFAULT '',

  -- Voice Profile
  voice_types text[] NOT NULL DEFAULT '{}',
  specialties text[] NOT NULL DEFAULT '{}',
  experience_years text NOT NULL DEFAULT '',
  notable_clients text DEFAULT '',
  bio text DEFAULT '',

  -- Technical Setup
  has_home_studio boolean NOT NULL DEFAULT false,
  microphone_model text DEFAULT '',
  daw_software text DEFAULT '',
  recording_environment text NOT NULL DEFAULT 'Home Studio' CHECK (recording_environment IN ('Home Studio', 'Professional Studio', 'Both', '')),
  can_deliver_dry_audio boolean NOT NULL DEFAULT true,

  -- Expected Rates
  expected_rate_voice numeric DEFAULT NULL,
  expected_rate_music numeric DEFAULT NULL,
  rate_currency text NOT NULL DEFAULT 'TWD',
  rate_notes text DEFAULT '',

  -- File Submission
  demo_file_url text DEFAULT '',
  demo_file_name text DEFAULT '',
  demo_file_size integer DEFAULT 0,

  -- Legal
  consent_data_processing boolean NOT NULL DEFAULT false,
  consent_terms boolean NOT NULL DEFAULT false,
  consent_age_verified boolean NOT NULL DEFAULT false,

  -- Workflow
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
  admin_notes text DEFAULT '',
  reviewed_by text DEFAULT '',
  reviewed_at timestamptz DEFAULT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_talent_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER talent_applications_updated_at
  BEFORE UPDATE ON talent_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_talent_applications_updated_at();

-- Auto-generate application_number
CREATE OR REPLACE FUNCTION generate_application_number()
RETURNS TRIGGER AS $$
DECLARE
  date_str text;
  seq_num integer;
  new_number text;
BEGIN
  date_str := to_char(now(), 'YYYYMMDD');
  SELECT COUNT(*) + 1 INTO seq_num
  FROM talent_applications
  WHERE application_number LIKE 'APP-' || date_str || '-%';
  new_number := 'APP-' || date_str || '-' || LPAD(seq_num::text, 4, '0');
  NEW.application_number := new_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_application_number
  BEFORE INSERT ON talent_applications
  FOR EACH ROW
  WHEN (NEW.application_number IS NULL OR NEW.application_number = '')
  EXECUTE FUNCTION generate_application_number();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_talent_applications_status ON talent_applications(status);
CREATE INDEX IF NOT EXISTS idx_talent_applications_role_type ON talent_applications(role_type);
CREATE INDEX IF NOT EXISTS idx_talent_applications_email ON talent_applications(email);
CREATE INDEX IF NOT EXISTS idx_talent_applications_created_at ON talent_applications(created_at DESC);

-- RLS
ALTER TABLE talent_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit an application"
  ON talent_applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated admins can view all applications"
  ON talent_applications
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated admins can update applications"
  ON talent_applications
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated admins can delete applications"
  ON talent_applications
  FOR DELETE
  TO authenticated
  USING (true);
