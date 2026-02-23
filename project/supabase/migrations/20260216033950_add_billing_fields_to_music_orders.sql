/*
  # Add Billing and Payment Fields to Music Orders

  1. Changes
    - Add `billing_details` (JSONB) field to store billing information
    - Add `payment_status` (text) field with check constraint
    - Add `region` (text) field to store user's country/region
    - Add `string_addon_id` (text) field to track selected string addon tier
    - Add `user_id` (uuid) field to link orders to authenticated users

  2. Security
    - No RLS changes needed as table already has RLS enabled
*/

DO $$
BEGIN
  -- Add billing_details column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'music_orders'
    AND column_name = 'billing_details'
  ) THEN
    ALTER TABLE music_orders ADD COLUMN billing_details JSONB DEFAULT '{}'::jsonb;
  END IF;

  -- Add payment_status column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'music_orders'
    AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE music_orders ADD COLUMN payment_status TEXT DEFAULT 'pending';
  END IF;

  -- Add region column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'music_orders'
    AND column_name = 'region'
  ) THEN
    ALTER TABLE music_orders ADD COLUMN region TEXT;
  END IF;

  -- Add string_addon_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'music_orders'
    AND column_name = 'string_addon_id'
  ) THEN
    ALTER TABLE music_orders ADD COLUMN string_addon_id TEXT;
  END IF;

  -- Add user_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'music_orders'
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE music_orders ADD COLUMN user_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Add check constraint for payment_status if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'music_orders_payment_status_check'
  ) THEN
    ALTER TABLE music_orders ADD CONSTRAINT music_orders_payment_status_check
      CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded'));
  END IF;
END $$;