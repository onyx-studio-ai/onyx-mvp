/*
  # Create Unified Multilingual Talent CMS System

  1. New Tables
    - `talents`
      - `id` (uuid, primary key)
      - `type` (text) - "singer" or "voice_actor"
      - `name` (text) - Talent's display name
      - `languages` (text[]) - Array of supported languages (e.g., ["English (US)", "Chinese (Mandarin)"])
      - `category` (text) - "in_house" or "featured"
      - `tags` (text[]) - Style/tone tags (e.g., ["Warm", "Corporate", "Rock"])
      - `gender` (text) - "male", "female", or "non_binary"
      - `bio` (text) - Talent biography/resume
      - `headshot_url` (text) - URL to headshot image in storage
      - `demo_urls` (jsonb) - Array of demo audio files with metadata
      - `internal_cost` (decimal) - Internal cost per project
      - `frontend_price` (decimal) - Auto-calculated (internal_cost * 1.6)
      - `is_active` (boolean) - Whether talent is currently available
      - `sort_order` (integer) - For manual ordering
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Storage Buckets
    - `talent_headshots` - For profile photos
    - `talent_demos` - For audio demo files

  3. Security
    - Enable RLS on talents table
    - Public read access for active talents
    - Admin-only write access
*/

-- Create talents table
CREATE TABLE IF NOT EXISTS talents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('singer', 'voice_actor')),
  name text NOT NULL,
  languages text[] NOT NULL DEFAULT '{}',
  category text NOT NULL CHECK (category IN ('in_house', 'featured')) DEFAULT 'in_house',
  tags text[] NOT NULL DEFAULT '{}',
  gender text CHECK (gender IN ('male', 'female', 'non_binary')),
  bio text,
  headshot_url text,
  demo_urls jsonb DEFAULT '[]'::jsonb,
  internal_cost decimal(10,2) NOT NULL DEFAULT 0,
  frontend_price decimal(10,2) GENERATED ALWAYS AS (internal_cost * 1.6) STORED,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_talents_type ON talents(type);
CREATE INDEX IF NOT EXISTS idx_talents_category ON talents(category);
CREATE INDEX IF NOT EXISTS idx_talents_is_active ON talents(is_active);
CREATE INDEX IF NOT EXISTS idx_talents_languages ON talents USING GIN(languages);
CREATE INDEX IF NOT EXISTS idx_talents_tags ON talents USING GIN(tags);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('talent_headshots', 'talent_headshots', true),
  ('talent_demos', 'talent_demos', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE talents ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active talents
CREATE POLICY "Anyone can view active talents"
  ON talents
  FOR SELECT
  USING (is_active = true);

-- Policy: Authenticated users can view all talents (for admin)
CREATE POLICY "Authenticated users can view all talents"
  ON talents
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only authenticated users can insert talents
CREATE POLICY "Authenticated users can insert talents"
  ON talents
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Only authenticated users can update talents
CREATE POLICY "Authenticated users can update talents"
  ON talents
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Only authenticated users can delete talents
CREATE POLICY "Authenticated users can delete talents"
  ON talents
  FOR DELETE
  TO authenticated
  USING (true);

-- Storage policies for talent_headshots
CREATE POLICY "Anyone can view headshots"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'talent_headshots');

CREATE POLICY "Authenticated users can upload headshots"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'talent_headshots');

CREATE POLICY "Authenticated users can update headshots"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'talent_headshots');

CREATE POLICY "Authenticated users can delete headshots"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'talent_headshots');

-- Storage policies for talent_demos
CREATE POLICY "Anyone can view demos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'talent_demos');

CREATE POLICY "Authenticated users can upload demos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'talent_demos');

CREATE POLICY "Authenticated users can update demos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'talent_demos');

CREATE POLICY "Authenticated users can delete demos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'talent_demos');

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_talents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function
CREATE TRIGGER talents_updated_at
  BEFORE UPDATE ON talents
  FOR EACH ROW
  EXECUTE FUNCTION update_talents_updated_at();