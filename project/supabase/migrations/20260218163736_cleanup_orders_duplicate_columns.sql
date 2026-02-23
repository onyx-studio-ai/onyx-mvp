/*
  # Clean up duplicate and unused columns in orders table

  ## Summary
  Remove redundant columns that are either duplicates or never used.
  All rows have NULL values in these columns so no data is lost.

  ## Columns being removed from `orders`
  - `tone` → duplicate of `tone_style` (all NULL)
  - `script` → duplicate of `script_text` (all NULL)
  - `reference_link` → not used by voice orders (all NULL)
  - `source_link` → not used by voice orders (all NULL)

  ## Columns being added to `orders`
  - `download_url` → used by frontend to show delivered audio file
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'tone'
  ) THEN
    ALTER TABLE orders DROP COLUMN tone;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'script'
  ) THEN
    ALTER TABLE orders DROP COLUMN script;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'reference_link'
  ) THEN
    ALTER TABLE orders DROP COLUMN reference_link;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'source_link'
  ) THEN
    ALTER TABLE orders DROP COLUMN source_link;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'download_url'
  ) THEN
    ALTER TABLE orders ADD COLUMN download_url text NULL;
  END IF;
END $$;
