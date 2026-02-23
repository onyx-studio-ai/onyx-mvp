/*
  # Add Broadcast Rights to Orders

  ## Overview
  Adds broadcast_rights column to the orders table to track whether customers
  have purchased the Broadcast & Paid TV Rights add-on (+$300 USD).

  ## 1. Changes
    - Add `broadcast_rights` column to orders table
      - Type: boolean
      - Default: false (not purchased)
      - Indicates if the order includes rights for TV, Radio, Cinema, and Paid Streaming Ads

  ## 2. Important Notes
    - This is an optional add-on that customers can purchase during checkout
    - When true, an additional $300 USD is added to the order total
    - Affects licensing permissions for the delivered audio
*/

-- Add broadcast_rights column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'broadcast_rights'
  ) THEN
    ALTER TABLE orders ADD COLUMN broadcast_rights boolean NOT NULL DEFAULT false;
  END IF;
END $$;