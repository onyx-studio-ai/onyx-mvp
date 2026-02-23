/*
  # Create orchestra_orders table

  ## Summary
  A new table for live string recording (Orchestra) orders. These are separate from
  voice_orders and music_orders because the service has a distinct workflow: the client
  submits a brief and later uploads their MIDI/score file through the dashboard, and the
  studio delivers multi-track stems.

  ## New Tables
  - `orchestra_orders`
    - `id` (uuid, primary key)
    - `order_number` (text, unique) — format: ORK-YYYYMMDD-XXXX
    - `email` (text) — client email, used as the access key
    - `user_id` (uuid, nullable) — linked to auth.users if logged in
    - `project_name` (text) — descriptive name for the project
    - `tier` (text) — pricing tier id: tier1 | tier2 | tier3 | tier4
    - `tier_name` (text) — human-readable tier name
    - `duration_minutes` (numeric) — total duration in minutes (affects pricing)
    - `price` (numeric) — total quoted price in USD
    - `genre` (text) — genre / style notes
    - `description` (text) — project brief / special instructions
    - `reference_url` (text, nullable) — YouTube or other reference link
    - `usage_type` (text) — e.g. Film, Game, Ad, YouTube
    - `midi_file_url` (text, nullable) — storage URL of uploaded MIDI/score file
    - `score_file_url` (text, nullable) — optional score PDF
    - `delivery_stems` (text[], nullable) — array of stem download URLs
    - `status` (text) — pending_payment | paid | awaiting_files | in_production | completed | failed
    - `payment_status` (text) — unpaid | paid | refunded
    - `payment_ref` (text, nullable)
    - `notes` (text, nullable) — internal admin notes
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated users can read/insert their own orders
  - Anon can insert (guest checkout) and read by email match is not allowed for anon
  - Service role has full access (for edge functions / admin)
*/

CREATE TABLE IF NOT EXISTS orchestra_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  email text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  project_name text NOT NULL DEFAULT '',
  tier text NOT NULL DEFAULT 'tier1',
  tier_name text NOT NULL DEFAULT '',
  duration_minutes numeric NOT NULL DEFAULT 1,
  price numeric NOT NULL DEFAULT 0,
  genre text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  reference_url text NOT NULL DEFAULT '',
  usage_type text NOT NULL DEFAULT '',
  midi_file_url text,
  score_file_url text,
  delivery_stems text[],
  status text NOT NULL DEFAULT 'pending_payment',
  payment_status text NOT NULL DEFAULT 'unpaid',
  payment_ref text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orchestra_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view own orchestra orders"
  ON orchestra_orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Authenticated users can insert own orchestra orders"
  ON orchestra_orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Anon can insert orchestra orders"
  ON orchestra_orders FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

CREATE POLICY "Authenticated users can update own orchestra orders"
  ON orchestra_orders FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE INDEX IF NOT EXISTS orchestra_orders_email_idx ON orchestra_orders(email);
CREATE INDEX IF NOT EXISTS orchestra_orders_user_id_idx ON orchestra_orders(user_id);
CREATE INDEX IF NOT EXISTS orchestra_orders_status_idx ON orchestra_orders(status);
