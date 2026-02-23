/*
  # Add string_addon column to music_orders

  ## Summary
  The music order form has a "Live String Recording" optional add-on section
  (Intimate Ensemble +$599, Rich Studio Strings +$749, Cinematic Symphony +$1,099).
  This column stores which string recording tier the customer selected.

  Previously named `string_tier` but that was removed as it sounded like a duplicate
  of `tier`. Renaming to `string_addon` to be unambiguous.

  ## Changes
  - Add `string_addon` (text, nullable) to `music_orders`
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'music_orders' AND column_name = 'string_addon'
  ) THEN
    ALTER TABLE music_orders ADD COLUMN string_addon text NULL;
  END IF;
END $$;
