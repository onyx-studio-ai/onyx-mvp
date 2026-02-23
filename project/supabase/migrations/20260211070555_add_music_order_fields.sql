/*
  # Add Music Order Support to Orders Table

  ## Overview
  Extends the orders table to support music production orders alongside voice orders.
  Adds music-specific fields while maintaining backward compatibility with voice orders.

  ## 1. New Columns
    - `order_type` (text) - Distinguishes between 'voice' and 'music' orders
    - `music_vibe` (text) - Selected music vibe/genre (e.g., 'Cyberpunk Pop', 'Lo-Fi Chill')
    - `sonic_reference_url` (text) - YouTube/Spotify/SoundCloud reference link
    - `usage_type` (text) - Intended usage (e.g., 'Commercial Advertisement', 'Social Media Content')

  ## 2. Status Updates
    - Add 'draft' status for abandoned cart recovery (early capture)
    - Draft orders can be converted to 'pending' when user completes checkout

  ## 3. Important Notes
    - All new columns are nullable to maintain compatibility with existing voice orders
    - Voice orders use: language, voice_selection, script_text, tone_style, use_case
    - Music orders use: music_vibe, sonic_reference_url, usage_type, description (via script_text)
    - The script_text field is reused for music project descriptions
    - The source_link field can be deprecated in favor of sonic_reference_url
*/

-- Add order_type column to distinguish voice vs music orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'order_type'
  ) THEN
    ALTER TABLE orders ADD COLUMN order_type text NOT NULL DEFAULT 'voice';
  END IF;
END $$;

-- Add music_vibe column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'music_vibe'
  ) THEN
    ALTER TABLE orders ADD COLUMN music_vibe text;
  END IF;
END $$;

-- Add sonic_reference_url column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'sonic_reference_url'
  ) THEN
    ALTER TABLE orders ADD COLUMN sonic_reference_url text;
  END IF;
END $$;

-- Add usage_type column for music orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'usage_type'
  ) THEN
    ALTER TABLE orders ADD COLUMN usage_type text;
  END IF;
END $$;

-- Update status check constraint to allow 'draft' status
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_status_check'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT orders_status_check;
  END IF;

  ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('draft', 'pending', 'processing', 'completed', 'failed'));
END $$;

-- Add check constraint for order_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_order_type_check'
  ) THEN
    ALTER TABLE orders
    ADD CONSTRAINT orders_order_type_check
    CHECK (order_type IN ('voice', 'music'));
  END IF;
END $$;

-- Create index on order_type for faster filtering
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);

-- Create index on sonic_reference_url for lookups
CREATE INDEX IF NOT EXISTS idx_orders_sonic_reference_url ON orders(sonic_reference_url);
