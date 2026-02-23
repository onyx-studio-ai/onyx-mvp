/*
  # Add Payment Tracking Fields

  ## Overview
  Adds payment tracking fields to orders and music_orders tables to support
  post-payment automation including status updates and email receipts.

  ## 1. Changes to Tables
    ### orders table
      - `paid_at` (timestamptz) - Timestamp when payment was confirmed
      - `transaction_id` (text) - TapPay transaction ID (rec_trade_id)
      - Update status check constraint to include 'paid' status

    ### music_orders table
      - `paid_at` (timestamptz) - Timestamp when payment was confirmed
      - `transaction_id` (text) - TapPay transaction ID (rec_trade_id)

  ## 2. Security
    - No RLS changes needed - existing policies cover these fields

  ## 3. Important Notes
    - Status flow: draft → pending → paid → processing → completed
    - 'paid' status indicates payment confirmed but generation not started
    - transaction_id stores TapPay's rec_trade_id for reconciliation
*/

-- Add payment fields to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'paid_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN paid_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'transaction_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN transaction_id text;
  END IF;
END $$;

-- Update status constraint to include 'paid'
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_status_check'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT orders_status_check;
  END IF;

  -- Add new constraint with 'paid' status
  ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status = ANY (ARRAY['draft'::text, 'pending'::text, 'paid'::text, 'processing'::text, 'completed'::text, 'failed'::text]));
END $$;

-- Add payment fields to music_orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'music_orders' AND column_name = 'paid_at'
  ) THEN
    ALTER TABLE music_orders ADD COLUMN paid_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'music_orders' AND column_name = 'transaction_id'
  ) THEN
    ALTER TABLE music_orders ADD COLUMN transaction_id text;
  END IF;
END $$;

-- Create index on transaction_id for lookups
CREATE INDEX IF NOT EXISTS idx_orders_transaction_id ON orders(transaction_id);
CREATE INDEX IF NOT EXISTS idx_music_orders_transaction_id ON music_orders(transaction_id);
