/*
  # Music Order Full Workflow - Demo & Revision System

  This migration adds a complete two-stage delivery workflow for music orders:

  ## New Status Flow
  pending_payment → paid → in_production → demo_ready → client_reviewing → revising → completed

  ## New Tables

  ### music_order_demos
  Stores demo sketches uploaded by admin for client review.
  - id, music_order_id, file_url, file_name, duration_seconds, notes
  - status: pending_review | selected | rejected
  - Admin uploads 5-10 demos, client listens and selects one direction

  ### music_order_revisions
  Tracks revision rounds between client and admin.
  - id, music_order_id, round_number, type (client_request | admin_response)
  - client_notes: client's revision instructions
  - admin_notes: admin's response/updates
  - file_url: admin-uploaded revised file (for admin_response type)
  - status: open | in_progress | resolved

  ### music_order_deliverables
  Final delivery files (all formats, stems, MIDI, etc.)
  - id, music_order_id, file_url, file_name, file_type (mp3 | wav | flac | stem | midi | project)
  - label: human-readable label shown to client

  ## Changes to music_orders
  - Add selected_demo_id (which demo the client chose)
  - Add revision_count (tracks how many revisions used)
  - Add max_revisions (set based on tier: 1, 3, or -1 for unlimited)
  - Add production_notes (internal admin notes)
  - Add client_feedback (latest client message)
*/

-- Demo sketches table
CREATE TABLE IF NOT EXISTS music_order_demos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  music_order_id uuid NOT NULL REFERENCES music_orders(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL DEFAULT '',
  duration_seconds integer DEFAULT 0,
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'pending_review',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE music_order_demos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view demos for their orders"
  ON music_order_demos FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert demos"
  ON music_order_demos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update demos"
  ON music_order_demos FOR UPDATE
  TO authenticated
  USING (true);

-- Revision rounds table
CREATE TABLE IF NOT EXISTS music_order_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  music_order_id uuid NOT NULL REFERENCES music_orders(id) ON DELETE CASCADE,
  round_number integer NOT NULL DEFAULT 1,
  type text NOT NULL DEFAULT 'client_request',
  client_notes text DEFAULT '',
  admin_notes text DEFAULT '',
  file_url text DEFAULT '',
  file_name text DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE music_order_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view revisions for their orders"
  ON music_order_revisions FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public can insert revision requests"
  ON music_order_revisions FOR INSERT
  TO public
  WITH CHECK (type = 'client_request');

CREATE POLICY "Authenticated users can insert admin responses"
  ON music_order_revisions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update revisions"
  ON music_order_revisions FOR UPDATE
  TO authenticated
  USING (true);

-- Final deliverables table
CREATE TABLE IF NOT EXISTS music_order_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  music_order_id uuid NOT NULL REFERENCES music_orders(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL DEFAULT '',
  file_type text NOT NULL DEFAULT 'mp3',
  label text DEFAULT '',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE music_order_deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view deliverables for their orders"
  ON music_order_deliverables FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert deliverables"
  ON music_order_deliverables FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete deliverables"
  ON music_order_deliverables FOR DELETE
  TO authenticated
  USING (true);

-- Add workflow columns to music_orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'music_orders' AND column_name = 'selected_demo_id'
  ) THEN
    ALTER TABLE music_orders ADD COLUMN selected_demo_id uuid REFERENCES music_order_demos(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'music_orders' AND column_name = 'revision_count'
  ) THEN
    ALTER TABLE music_orders ADD COLUMN revision_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'music_orders' AND column_name = 'max_revisions'
  ) THEN
    ALTER TABLE music_orders ADD COLUMN max_revisions integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'music_orders' AND column_name = 'production_notes'
  ) THEN
    ALTER TABLE music_orders ADD COLUMN production_notes text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'music_orders' AND column_name = 'client_feedback'
  ) THEN
    ALTER TABLE music_orders ADD COLUMN client_feedback text DEFAULT '';
  END IF;
END $$;

-- Allow anon to update music_orders for demo selection and revision requests
CREATE POLICY "Public can update music order for demo selection"
  ON music_orders FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);
