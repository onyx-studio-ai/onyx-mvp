/*
  # Orchestra Workflow Enhancement
  
  Adds messaging system and delivery tracking for Live Strings orders.
  
  ## New Table: orchestra_messages
  Thread-based messaging between admin and client during under_review and delivered phases.
  
  ## New Columns on orchestra_orders
  - estimated_delivery_date: admin-set estimated completion date
  - delivery_file_url: final delivery package URL
  - delivered_at: timestamp when delivery was uploaded
  - auto_complete_at: auto-close date (delivered_at + 14 days)
*/

-- Create orchestra_messages table
CREATE TABLE IF NOT EXISTS orchestra_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orchestra_orders(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('admin', 'client')),
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE orchestra_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on orchestra_messages"
  ON orchestra_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view messages for their orders"
  ON orchestra_messages FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orchestra_orders
      WHERE user_id = auth.uid()
         OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Authenticated users can insert messages for their orders"
  ON orchestra_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_role = 'client'
    AND order_id IN (
      SELECT id FROM orchestra_orders
      WHERE user_id = auth.uid()
         OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS orchestra_messages_order_id_idx ON orchestra_messages(order_id);

-- Add new columns to orchestra_orders
ALTER TABLE orchestra_orders
  ADD COLUMN IF NOT EXISTS estimated_delivery_date date,
  ADD COLUMN IF NOT EXISTS delivery_file_url text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_complete_at timestamptz;
