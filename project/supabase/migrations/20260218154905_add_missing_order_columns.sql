/*
  # Add missing columns to orders and music_orders tables

  ## Summary
  The API routes reference columns that don't exist in the database tables.
  This migration adds them.

  ## Changes to `orders` table
  - `talent_id` (uuid, nullable) - reference to selected voice talent
  - `talent_price` (numeric, default 0) - talent addon price
  - `source_link` (text, nullable) - reference/source link
  - `payment_status` (text, default 'pending') - payment state

  ## Changes to `music_orders` table
  - `payment_status` (text, default 'pending') - payment state
  - `talent_price` (numeric, default 0) - talent price for singer addon

  ## No RLS changes - existing policies remain in place
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'talent_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN talent_id uuid NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'talent_price'
  ) THEN
    ALTER TABLE orders ADD COLUMN talent_price numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'source_link'
  ) THEN
    ALTER TABLE orders ADD COLUMN source_link text NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_status text DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'music_orders' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE music_orders ADD COLUMN payment_status text DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'music_orders' AND column_name = 'talent_price'
  ) THEN
    ALTER TABLE music_orders ADD COLUMN talent_price numeric DEFAULT 0;
  END IF;
END $$;
