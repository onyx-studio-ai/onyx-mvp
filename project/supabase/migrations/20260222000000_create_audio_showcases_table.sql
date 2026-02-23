/*
  # Audio Showcases Table

  Manages audio files and text content for all front-end showcase sections:
  - featured_voices: Featured Voices cards on /voice page
  - voice_tier: Voice Tier Comparison (AI Instant / Director's Cut / Live Studio)
  - music_comparison: Raw AI Output vs Onyx Studio Finish on /music page
  - orchestra_comparison: AI vs Human Friction on /music/orchestra page

  Each row represents a single audio slot identified by (section, slot_key).
*/

CREATE TABLE IF NOT EXISTS audio_showcases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section text NOT NULL,
  slot_key text NOT NULL,
  audio_url text,
  label text,
  subtitle text,
  description text,
  tags jsonb DEFAULT '[]'::jsonb,
  sort_order int DEFAULT 0,
  updated_at timestamptz DEFAULT now(),

  UNIQUE (section, slot_key)
);

ALTER TABLE audio_showcases ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'audio_showcases' AND policyname = 'Anyone can view audio_showcases'
  ) THEN
    CREATE POLICY "Anyone can view audio_showcases"
      ON audio_showcases FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'audio_showcases' AND policyname = 'Anon can insert audio_showcases'
  ) THEN
    CREATE POLICY "Anon can insert audio_showcases"
      ON audio_showcases FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'audio_showcases' AND policyname = 'Anon can update audio_showcases'
  ) THEN
    CREATE POLICY "Anon can update audio_showcases"
      ON audio_showcases FOR UPDATE
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'audio_showcases' AND policyname = 'Anon can delete audio_showcases'
  ) THEN
    CREATE POLICY "Anon can delete audio_showcases"
      ON audio_showcases FOR DELETE
      USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audio_showcases_section ON audio_showcases(section);

-- Seed default rows so admin page has slots to fill
INSERT INTO audio_showcases (section, slot_key, label, subtitle, description, tags, sort_order)
VALUES
  ('featured_voices', 'slot_1', 'Onyx Alpha', 'The Authority', 'Deep, commanding presence for high-stakes narration', '["News","Corporate","Deep"]', 0),
  ('featured_voices', 'slot_2', 'Onyx Nova', 'The Visionary', 'Crystalline clarity with sophisticated warmth', '["Tech","Premium","Elegant"]', 1),
  ('featured_voices', 'slot_3', 'Onyx Titan', 'The Catalyst', 'Bold, dynamic energy for impactful storytelling', '["Trailer","Action","Power"]', 2),
  ('voice_tier', 'standard', NULL, NULL, NULL, '[]', 0),
  ('voice_tier', 'onyx', NULL, NULL, NULL, '[]', 1),
  ('voice_tier', 'human', NULL, NULL, NULL, '[]', 2),
  ('music_comparison', 'raw', NULL, NULL, NULL, '[]', 0),
  ('music_comparison', 'onyx', NULL, NULL, NULL, '[]', 1),
  ('orchestra_comparison', 'raw', NULL, NULL, NULL, '[]', 0),
  ('orchestra_comparison', 'live', NULL, NULL, NULL, '[]', 1)
ON CONFLICT (section, slot_key) DO NOTHING;

-- Create storage bucket for showcase audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('showcases', 'showcases', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Anyone can read showcases'
  ) THEN
    CREATE POLICY "Anyone can read showcases"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'showcases');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Anon can upload to showcases'
  ) THEN
    CREATE POLICY "Anon can upload to showcases"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'showcases');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Anon can update showcases'
  ) THEN
    CREATE POLICY "Anon can update showcases"
      ON storage.objects FOR UPDATE
      USING (bucket_id = 'showcases')
      WITH CHECK (bucket_id = 'showcases');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Anon can delete from showcases'
  ) THEN
    CREATE POLICY "Anon can delete from showcases"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'showcases');
  END IF;
END $$;
