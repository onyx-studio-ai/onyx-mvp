/*
  # Create Certificates Table & Storage

  ## Summary
  Creates the certificates table for License Certificate management,
  and the certificates storage bucket for PDF files.

  ## New Tables

  ### certificates
  - id (uuid, PK)
  - license_id (text, unique) — format: ONYX-[order_number]
  - order_id (text) — references the source order
  - order_type (text) — 'voice' | 'music' | 'orchestra'
  - order_number (text)
  - client_email (text)
  - client_name (text, optional)
  - project_name (text, optional)
  - product_category (text) — e.g., "Masterpiece", "100% Live Studio"
  - asset_type (text) — e.g., "Vocal", "Music", "Live Strings"
  - rights_level (text) — 'standard' | 'broadcast' | 'global'
  - rights_details (jsonb) — full list of granted rights
  - voice_id_ref (text, optional) — VID-XXXX reference
  - talent_name (text, optional)
  - audio_specs (text, optional) — e.g., "24-bit/48kHz WAV"
  - qr_code_url (text, optional) — URL for the QR code verification link
  - pdf_url (text) — Supabase Storage URL for the generated PDF
  - issued_at (timestamptz)
  - created_at (timestamptz)

  ## Storage
  - Creates certificates bucket for PDF storage
*/

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

CREATE POLICY "Authenticated users can manage certificates"
  ON certificates
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can read certificates by license_id"
  ON certificates
  FOR SELECT
  TO anon
  USING (true);

-- === certificates storage bucket ===
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificates', 'certificates', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read certificates files"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'certificates');

CREATE POLICY "Authenticated users can upload certificates"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'certificates');
