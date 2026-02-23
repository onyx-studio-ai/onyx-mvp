/*
  # Add Download URL to Orders

  ## Overview
  Adds download_url column to the orders table to support the Tier 2 delivery workflow.
  This enables automated delivery of manually processed audio files.

  ## 1. Changes
    - Add `download_url` column to orders table
      - Type: text (nullable)
      - Stores the public URL to the delivered audio file
      - Populated when admin uploads the completed file to Supabase Storage
      - Used by customers to download their completed orders

  ## 2. Workflow
    - Tier 2 orders start with status='processing' after payment
    - Admin uploads completed file to Supabase Storage bucket 'deliverables'
    - System updates status='completed' and sets download_url
    - Customer can download via the dashboard

  ## 3. Important Notes
    - This field is nullable since it's only populated after manual processing
    - Only set when status changes to 'completed'
    - URL points to files in Supabase Storage 'deliverables' bucket
*/

-- Add download_url column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'download_url'
  ) THEN
    ALTER TABLE orders ADD COLUMN download_url text;
  END IF;
END $$;