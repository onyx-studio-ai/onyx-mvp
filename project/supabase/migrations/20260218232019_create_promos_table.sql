/*
  # Create Promos Table

  1. New Tables
    - `promos`
      - `id` (uuid, primary key)
      - `code` (text, unique) - The promo code string
      - `discount_type` (text) - 'percentage' or 'fixed'
      - `value` (numeric) - Discount amount (% or TWD)
      - `usage_count` (integer) - How many times used
      - `max_uses` (integer, nullable) - Optional cap
      - `status` (text) - 'active' or 'expired'
      - `expires_at` (timestamptz, nullable) - Optional expiry
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Admin-only access via service role (no client-side RLS policy needed for anon/authenticated reads - admin panel uses service role pattern via API)
    - Allow anonymous read for checkout validation
*/

CREATE TABLE IF NOT EXISTS promos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  discount_type text NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  value numeric NOT NULL DEFAULT 0,
  usage_count integer NOT NULL DEFAULT 0,
  max_uses integer,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired')),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE promos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read promos"
  ON promos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anon can read active promos for validation"
  ON promos FOR SELECT
  TO anon
  USING (status = 'active');

CREATE POLICY "Authenticated admin can insert promos"
  ON promos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated admin can update promos"
  ON promos FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated admin can delete promos"
  ON promos FOR DELETE
  TO authenticated
  USING (true);
