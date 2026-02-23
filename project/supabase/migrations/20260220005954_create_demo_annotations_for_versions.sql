/*
  # Create demo_annotations table linked to music_order_versions

  ## Summary
  The original demo_annotations table referenced music_order_demos which doesn't exist.
  This migration creates the table correctly referencing music_order_versions.

  ## New Tables
  - `demo_annotations`
    - `id` — primary key
    - `demo_id` — foreign key to music_order_versions (the version/demo being annotated)
    - `music_order_id` — foreign key to music_orders for RLS convenience
    - `time_start` (numeric) — start time in seconds
    - `time_end` (numeric, nullable) — end time for range annotations
    - `annotation_type` — keep | change | question
    - `category` — mix | intensity | mood | instrument | arrangement | tempo | melody | structure | other
    - `label` — short descriptor
    - `notes` — free-form notes
    - `created_at`

  ## Security
  - RLS enabled
  - Public can select, insert, delete (annotations are tied to paid orders, no user auth required)
*/

CREATE TABLE IF NOT EXISTS demo_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_id uuid NOT NULL REFERENCES music_order_versions(id) ON DELETE CASCADE,
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

CREATE POLICY "Public can delete demo annotations"
  ON demo_annotations FOR DELETE
  TO public
  USING (true);

CREATE INDEX IF NOT EXISTS idx_demo_annotations_demo_id ON demo_annotations(demo_id);
CREATE INDEX IF NOT EXISTS idx_demo_annotations_order_id ON demo_annotations(music_order_id);
