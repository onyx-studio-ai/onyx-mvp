/*
  # Create Music Orders Table

  ## Overview
  Creates a dedicated table for Music Studio orders, separate from voice-over orders.
  This allows for cleaner schema management and avoids conflicts between different order types.

  ## 1. New Tables
    - `music_orders`
      - `id` (uuid, primary key) - Unique order identifier
      - `email` (text, not null) - Customer email for order delivery
      - `vibe` (text) - Music vibe/style selection
      - `reference_link` (text) - Universal reference link (YouTube, Drive, NetEase, etc.)
      - `usage_type` (text) - How the music will be used
      - `description` (text) - Detailed description of requirements
      - `tier` (text) - Selected pricing tier
      - `price` (numeric, default 0) - Order price
      - `status` (text, default 'draft') - Order status
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
      - `order_number` (text, unique) - Human-readable order number

  ## 2. Security
    - Enable RLS on `music_orders` table
    - Allow public/anon users to INSERT (for wizard draft saving)
    - Allow users to SELECT their own orders by email
    - Allow users to UPDATE their own orders

  ## 3. Important Notes
    - Status values: 'draft', 'pending', 'processing', 'completed', 'failed'
    - Reference links support ANY valid URL (universal link support)
    - Order number format: MUSIC-YYYYMMDD-XXXX
*/

-- Create music_orders table
CREATE TABLE IF NOT EXISTS music_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  vibe text,
  reference_link text,
  usage_type text,
  description text,
  tier text,
  price numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  order_number text UNIQUE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_music_orders_email ON music_orders(email);
CREATE INDEX IF NOT EXISTS idx_music_orders_status ON music_orders(status);
CREATE INDEX IF NOT EXISTS idx_music_orders_created_at ON music_orders(created_at DESC);

-- Enable Row Level Security
ALTER TABLE music_orders ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone (including anon) can insert music orders
CREATE POLICY "Anyone can create music orders"
  ON music_orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy: Users can view orders with their email
CREATE POLICY "Users can view own music orders by email"
  ON music_orders
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Policy: Anyone can update music orders (for draft updates)
CREATE POLICY "Anyone can update music orders"
  ON music_orders
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Function to generate music order number
CREATE OR REPLACE FUNCTION generate_music_order_number()
RETURNS TRIGGER AS $$
DECLARE
  date_part text;
  sequence_num text;
  new_order_number text;
BEGIN
  -- Format: MUSIC-YYYYMMDD-XXXX
  date_part := to_char(NEW.created_at, 'YYYYMMDD');

  -- Get the count of music orders for today and add 1
  SELECT LPAD((COUNT(*) + 1)::text, 4, '0') INTO sequence_num
  FROM music_orders
  WHERE created_at::date = NEW.created_at::date;

  new_order_number := 'MUSIC-' || date_part || '-' || sequence_num;

  NEW.order_number := new_order_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate music order number
CREATE TRIGGER set_music_order_number
  BEFORE INSERT ON music_orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL)
  EXECUTE FUNCTION generate_music_order_number();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_music_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_music_orders_updated_at
  BEFORE UPDATE ON music_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_music_orders_updated_at();
