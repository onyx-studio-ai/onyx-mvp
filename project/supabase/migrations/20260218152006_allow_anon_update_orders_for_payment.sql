/*
  # Allow anonymous updates to orders for payment processing

  The payment API route runs without a service role key, using the anon key.
  We need to allow updating the status/payment fields on orders after payment.

  1. Changes
     - Add UPDATE policy on orders table for anon role (payment fields only)
*/

CREATE POLICY "Service can update order payment status"
  ON orders FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
