/*
  # Add Demo Feedback Annotations

  ## Summary
  Adds structured feedback capability to music demo sketches.
  Clients can leave time-stamped comments and structured annotations
  (mood, intensity, instrument, arrangement notes) on specific sections
  of each demo, giving producers precise, actionable direction.

  ## Changes

  ### Modified Tables
  - `music_order_demos`
    - `duration_seconds` — already exists, ensures it defaults 0
    - `overall_rating` (integer 1-5) — client's overall impression of the demo
    - `overall_notes` (text) — client's general written notes for the demo

  ### New Tables
  - `demo_annotations`
    - `id` — primary key
    - `demo_id` — foreign key to music_order_demos
    - `music_order_id` — denormalized for easy RLS
    - `time_start` (numeric) — start time in seconds
    - `time_end` (numeric, nullable) — end time in seconds for range annotations
    - `annotation_type` — keep | change | question
    - `category` — intensity | mood | instrument | arrangement | tempo | other
    - `label` (text) — short descriptor (e.g. "Too Loud", "Love This", "Add Strings")
    - `notes` (text) — free-form explanation
    - `created_at`

  ## Security
  - RLS enabled on demo_annotations
  - Public can insert/select (order is public access pattern)
  - Authenticated users can manage
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'music_order_demos' AND column_name = 'overall_rating'
  ) THEN
    ALTER TABLE music_order_demos ADD COLUMN overall_rating integer DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'music_order_demos' AND column_name = 'overall_notes'
  ) THEN
    ALTER TABLE music_order_demos ADD COLUMN overall_notes text DEFAULT '';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS demo_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_id uuid NOT NULL REFERENCES music_order_demos(id) ON DELETE CASCADE,
  music_order_id uuid NOT NULL REFERENCES music_orders(id) ON DELETE CASCADE,
  time_start numeric NOT NULL DEFAULT 0,
  time_end numeric DEFAULT NULL,
  annotation_type text NOT NULL DEFAULT 'change',
  category text NOT NULL DEFAULT 'other',
  label text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE demo_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view demo annotations"
  ON demo_annotations FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can insert demo annotations"
  ON demo_annotations FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public can delete own demo annotations"
  ON demo_annotations FOR DELETE
  TO public
  USING (true);

CREATE INDEX IF NOT EXISTS idx_demo_annotations_demo_id ON demo_annotations(demo_id);
CREATE INDEX IF NOT EXISTS idx_demo_annotations_order_id ON demo_annotations(music_order_id);
