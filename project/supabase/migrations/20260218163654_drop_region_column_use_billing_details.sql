/*
  # Drop redundant region column from orders and music_orders

  ## Summary
  The `region` column is redundant because billing country/region info
  is already stored in the `billing_details` jsonb column.
  This removes the duplicate column to keep the schema clean.

  ## Changes
  - DROP `region` column from `orders` table
  - DROP `region` column from `music_orders` table

  Note: Both tables have no rows with region data (all NULL), so this is safe.
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'region'
  ) THEN
    ALTER TABLE orders DROP COLUMN region;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'music_orders' AND column_name = 'region'
  ) THEN
    ALTER TABLE music_orders DROP COLUMN region;
  END IF;
END $$;
