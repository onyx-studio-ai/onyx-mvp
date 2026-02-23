/*
  # Add Talent Information to Orders

  1. Changes to `orders` table
    - Add `talent_id` (uuid) - Foreign key to talents table
    - Add `talent_price` (decimal) - Price for the selected talent

  2. Changes to `music_orders` table
    - Add `talent_id` (uuid) - Foreign key to talents table
    - Add `talent_price` (decimal) - Price for the selected talent

  3. Indexes
    - Add indexes for faster talent lookups

  4. Foreign Keys
    - Link talent_id to talents table
*/

-- Add talent fields to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'talent_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN talent_id uuid REFERENCES talents(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'talent_price'
  ) THEN
    ALTER TABLE orders ADD COLUMN talent_price decimal(10,2) DEFAULT 0;
  END IF;
END $$;

-- Add talent fields to music_orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'music_orders' AND column_name = 'talent_id'
  ) THEN
    ALTER TABLE music_orders ADD COLUMN talent_id uuid REFERENCES talents(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'music_orders' AND column_name = 'talent_price'
  ) THEN
    ALTER TABLE music_orders ADD COLUMN talent_price decimal(10,2) DEFAULT 0;
  END IF;
END $$;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_talent_id ON orders(talent_id);
CREATE INDEX IF NOT EXISTS idx_music_orders_talent_id ON music_orders(talent_id);
