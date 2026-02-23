/*
  # Add Tone Style and Use Case to Orders

  ## Overview
  Adds tone_style and use_case columns to the orders table to capture
  production requirements for high-quality audio generation.

  ## 1. Changes
    - Add `tone_style` column to orders table
      - Options: Professional, Energetic, Soothing, Movie Trailer, Friendly
      - Required field (NOT NULL)
    - Add `use_case` column to orders table
      - Options: Advertisement, Audiobook, Social Media, E-Learning
      - Required field (NOT NULL)

  ## 2. Important Notes
    - These fields provide structured data for backend automation
    - Ensures consistent, high-quality audio generation
    - Both fields are required for all new orders
*/

-- Add tone_style column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'tone_style'
  ) THEN
    ALTER TABLE orders ADD COLUMN tone_style text NOT NULL DEFAULT 'Professional';
  END IF;
END $$;

-- Add use_case column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'use_case'
  ) THEN
    ALTER TABLE orders ADD COLUMN use_case text NOT NULL DEFAULT 'Advertisement';
  END IF;
END $$;

-- Add check constraints to ensure valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_tone_style_check'
  ) THEN
    ALTER TABLE orders
    ADD CONSTRAINT orders_tone_style_check
    CHECK (tone_style IN ('Professional', 'Energetic', 'Soothing', 'Movie Trailer', 'Friendly'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_use_case_check'
  ) THEN
    ALTER TABLE orders
    ADD CONSTRAINT orders_use_case_check
    CHECK (use_case IN ('Advertisement', 'Audiobook', 'Social Media', 'E-Learning'));
  END IF;
END $$;