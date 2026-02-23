/*
  # Analytics & Feedback System

  1. New Tables
    - `generation_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `tier` (text) - tier1, tier2, or tier3
      - `voice_model_id` (text) - voice identifier like 'nova', 'arthur', etc.
      - `status` (text) - success or failed
      - `processing_time_ms` (integer) - processing time in milliseconds
      - `cost_estimated` (float) - estimated cost for this generation
      - `created_at` (timestamptz) - timestamp of generation

    - `feedback_logs`
      - `id` (uuid, primary key)
      - `generation_id` (uuid, foreign key to generation_logs)
      - `rating` (boolean) - true for thumbs up, false for thumbs down
      - `reason` (text) - robotic, glitch, pronunciation, other (optional)
      - `comment` (text) - user's additional comments (optional)
      - `created_at` (timestamptz) - timestamp of feedback

  2. Security
    - Enable RLS on both tables
    - Users can insert their own logs
    - Users can read their own logs
    - Users can insert feedback for their own generations
*/

-- Create generation_logs table
CREATE TABLE IF NOT EXISTS generation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tier text NOT NULL CHECK (tier IN ('tier1', 'tier2', 'tier3')),
  voice_model_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'failed')),
  processing_time_ms integer DEFAULT 0,
  cost_estimated numeric(10, 4) DEFAULT 0.0,
  created_at timestamptz DEFAULT now()
);

-- Create feedback_logs table
CREATE TABLE IF NOT EXISTS feedback_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id uuid REFERENCES generation_logs(id) ON DELETE CASCADE NOT NULL,
  rating boolean NOT NULL,
  reason text CHECK (reason IN ('robotic', 'glitch', 'pronunciation', 'other')),
  comment text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE generation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_logs ENABLE ROW LEVEL SECURITY;

-- Generation logs policies
CREATE POLICY "Users can insert their own generation logs"
  ON generation_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own generation logs"
  ON generation_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Feedback logs policies
CREATE POLICY "Users can insert feedback for their own generations"
  ON feedback_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM generation_logs
      WHERE generation_logs.id = feedback_logs.generation_id
      AND generation_logs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view feedback for their own generations"
  ON feedback_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM generation_logs
      WHERE generation_logs.id = feedback_logs.generation_id
      AND generation_logs.user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_generation_logs_user_id ON generation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_logs_created_at ON generation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_logs_generation_id ON feedback_logs(generation_id);
