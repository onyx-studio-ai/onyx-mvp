/*
  # Add download_url to music_orders

  Adds a download_url column to music_orders so admin can upload and deliver completed music files.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'music_orders' AND column_name = 'download_url'
  ) THEN
    ALTER TABLE music_orders ADD COLUMN download_url text DEFAULT NULL;
  END IF;
END $$;
