/*
  # Add Tier, Price, Duration, and Project Name to Orders

  ## Overview
  Extends the orders table with fields required for the guest checkout flow:
  tier selection, calculated price, estimated duration, and auto-generated project name.

  ## 1. New Columns
    - `tier` (text) - Selected pricing tier ('tier-1' for AI Instant, 'tier-2' for Director's Cut)
    - `price` (numeric) - Final calculated price in USD including any add-ons
    - `duration` (integer) - Estimated audio duration in minutes
    - `project_name` (text) - Auto-generated human-friendly project label

  ## 2. Important Notes
    - All columns have sensible defaults and are nullable to avoid breaking existing rows
    - Price is stored as numeric(10,2) for precise currency values
    - Duration is in whole minutes (rounded up from word count estimate)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'tier'
  ) THEN
    ALTER TABLE orders ADD COLUMN tier text NOT NULL DEFAULT 'tier-1';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'price'
  ) THEN
    ALTER TABLE orders ADD COLUMN price numeric(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'duration'
  ) THEN
    ALTER TABLE orders ADD COLUMN duration integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'project_name'
  ) THEN
    ALTER TABLE orders ADD COLUMN project_name text NOT NULL DEFAULT '';
  END IF;
END $$;