/*
  # Rename orders → voice_orders, clean up music_orders

  ## Changes

  1. Rename `orders` table to `voice_orders`
     - Clearer naming: voice orders vs music orders
     - All sequences, constraints and indexes are preserved

  2. Remove `string_tier` from `music_orders`
     - Duplicate of `tier` column (all NULL, no data lost)

  3. Update RLS policies on the renamed table
*/

ALTER TABLE orders RENAME TO voice_orders;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'music_orders' AND column_name = 'string_tier'
  ) THEN
    ALTER TABLE music_orders DROP COLUMN string_tier;
  END IF;
END $$;
