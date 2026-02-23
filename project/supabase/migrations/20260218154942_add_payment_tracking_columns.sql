/*
  # Add payment tracking columns to orders and music_orders

  ## Summary
  The payment API updates order records with transaction info after successful payment.
  These columns need to exist in both tables.

  ## Changes to `orders` table
  - `paid_at` (timestamptz, nullable) - when payment was completed
  - `transaction_id` (text, nullable) - TapPay transaction reference
  - `updated_at` (timestamptz, default now()) - last update timestamp
  - `user_id` (uuid, nullable) - auth user reference after payment
  - `region` (text, nullable) - billing region/country
  - `billing_details` (jsonb, nullable) - full billing info

  ## Changes to `music_orders` table
  - `paid_at` (timestamptz, nullable) - when payment was completed
  - `transaction_id` (text, nullable) - TapPay transaction reference
  - `user_id` (uuid, nullable) - auth user reference after payment
  - `region` (text, nullable) - billing region/country
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'paid_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN paid_at timestamptz NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'transaction_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN transaction_id text NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN user_id uuid NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'region'
  ) THEN
    ALTER TABLE orders ADD COLUMN region text NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'billing_details'
  ) THEN
    ALTER TABLE orders ADD COLUMN billing_details jsonb NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'music_orders' AND column_name = 'paid_at'
  ) THEN
    ALTER TABLE music_orders ADD COLUMN paid_at timestamptz NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'music_orders' AND column_name = 'transaction_id'
  ) THEN
    ALTER TABLE music_orders ADD COLUMN transaction_id text NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'music_orders' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE music_orders ADD COLUMN user_id uuid NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'music_orders' AND column_name = 'region'
  ) THEN
    ALTER TABLE music_orders ADD COLUMN region text NULL;
  END IF;
END $$;
