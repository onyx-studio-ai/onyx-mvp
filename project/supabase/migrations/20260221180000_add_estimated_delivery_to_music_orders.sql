-- Add estimated_delivery_date to music_orders
-- Allows admin to set an estimated delivery date when starting production

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'music_orders' AND column_name = 'estimated_delivery_date'
  ) THEN
    ALTER TABLE music_orders ADD COLUMN estimated_delivery_date date;
  END IF;
END
$$;
