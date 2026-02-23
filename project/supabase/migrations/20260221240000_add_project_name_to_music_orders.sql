-- Add project_name column to music_orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'music_orders' AND column_name = 'project_name'
  ) THEN
    ALTER TABLE music_orders ADD COLUMN project_name text;
  END IF;
END $$;
