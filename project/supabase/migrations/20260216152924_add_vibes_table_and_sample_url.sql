/*
  # Music Catalog Enhancement

  1. New Tables
    - `vibes` (Instrumental Tracks)
      - `id` (uuid, primary key)
      - `title` (text) - Track title
      - `genre` (text) - Music genre
      - `description` (text) - Track description
      - `image_url` (text) - Cover image URL
      - `audio_url` (text) - Audio file URL for player
      - `created_at` (timestamptz) - Creation timestamp

  2. Schema Changes
    - Add `sample_url` column to `talents` table for audio preview

  3. Security
    - Enable RLS on vibes table
    - Add policies for public read access (catalog is public)
    - Restrict write operations to authenticated users only

  4. Indexes
    - Add index on vibes genre for filtering
*/

-- Create vibes table
CREATE TABLE IF NOT EXISTS vibes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  genre text NOT NULL,
  description text DEFAULT '',
  image_url text NOT NULL,
  audio_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add sample_url to talents if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'talents' AND column_name = 'sample_url'
  ) THEN
    ALTER TABLE talents ADD COLUMN sample_url text;
  END IF;
END $$;

-- Enable Row Level Security on vibes
ALTER TABLE vibes ENABLE ROW LEVEL SECURITY;

-- Public read access for catalog browsing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vibes' AND policyname = 'Anyone can view vibes'
  ) THEN
    CREATE POLICY "Anyone can view vibes"
      ON vibes FOR SELECT
      USING (true);
  END IF;
END $$;

-- Authenticated users can insert vibes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vibes' AND policyname = 'Authenticated users can insert vibes'
  ) THEN
    CREATE POLICY "Authenticated users can insert vibes"
      ON vibes FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- Authenticated users can update vibes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vibes' AND policyname = 'Authenticated users can update vibes'
  ) THEN
    CREATE POLICY "Authenticated users can update vibes"
      ON vibes FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Authenticated users can delete vibes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vibes' AND policyname = 'Authenticated users can delete vibes'
  ) THEN
    CREATE POLICY "Authenticated users can delete vibes"
      ON vibes FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_vibes_genre ON vibes(genre);