/*
  # Create Orders Table

  ## Overview
  Creates the core orders table for Onyx Studios Platform's digital audio order management system.
  This table stores customer orders with their preferences and processing status.

  ## 1. New Tables
    - `orders`
      - `id` (uuid, primary key) - Unique order identifier
      - `email` (text, not null) - Customer email for order delivery and authentication
      - `language` (text, not null) - Selected language for the audio (e.g., 'en', 'zh-TW', 'zh-CN')
      - `voice_selection` (text, not null) - Selected voice ID/name (e.g., 'male_1', 'female_2')
      - `script_text` (text, not null) - The script content to be converted to audio
      - `source_link` (text) - Optional reference link to Google Drive/Dropbox files
      - `status` (text, not null, default 'pending') - Order processing status
      - `created_at` (timestamptz) - Order creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
      - `order_number` (text, unique) - Human-readable order number

  ## 2. Security
    - Enable RLS on `orders` table
    - Allow anyone to insert new orders (for guest checkout)
    - Allow users to view orders matching their email address
    - Only authenticated users matching the email can update their orders

  ## 3. Indexes
    - Index on email for faster order lookups
    - Index on status for admin filtering
    - Index on created_at for chronological sorting

  ## 4. Important Notes
    - Status values: 'pending', 'processing', 'completed', 'failed'
    - Order number format: ONYX-YYYYMMDD-XXXX
    - Guest checkout supported via email matching
*/

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  language text NOT NULL,
  voice_selection text NOT NULL,
  script_text text NOT NULL,
  source_link text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  order_number text UNIQUE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- Enable Row Level Security
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert orders (guest checkout)
CREATE POLICY "Anyone can create orders"
  ON orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy: Users can view orders with their email
CREATE POLICY "Users can view own orders by email"
  ON orders
  FOR SELECT
  TO anon, authenticated
  USING (email = current_setting('request.jwt.claims', true)::json->>'email' OR auth.email() = email);

-- Policy: Authenticated users can update their own orders
CREATE POLICY "Users can update own orders"
  ON orders
  FOR UPDATE
  TO authenticated
  USING (auth.email() = email)
  WITH CHECK (auth.email() = email);

-- Function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  date_part text;
  sequence_num text;
  new_order_number text;
BEGIN
  -- Format: ONYX-YYYYMMDD-XXXX
  date_part := to_char(NEW.created_at, 'YYYYMMDD');
  
  -- Get the count of orders for today and add 1
  SELECT LPAD((COUNT(*) + 1)::text, 4, '0') INTO sequence_num
  FROM orders
  WHERE created_at::date = NEW.created_at::date;
  
  new_order_number := 'ONYX-' || date_part || '-' || sequence_num;
  
  NEW.order_number := new_order_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate order number
CREATE TRIGGER set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL)
  EXECUTE FUNCTION generate_order_number();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();