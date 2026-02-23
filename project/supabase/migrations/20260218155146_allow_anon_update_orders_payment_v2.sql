/*
  # Allow anon role to update orders for payment processing

  The payment API uses anon key (no service role). We need anon to be able
  to update payment status fields after successful TapPay transactions.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders'
    AND policyname = 'Service can update order payment status'
  ) THEN
    CREATE POLICY "Service can update order payment status"
      ON orders FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
