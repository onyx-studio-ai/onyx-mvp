/*
  # Change voice_orders.order_number from integer to text

  ## Summary
  Converts the order_number column from integer (sequence-based) to text
  so it can store the formatted order number string.

  ## Changes
  - Drops the integer default (sequence) from order_number
  - Converts the column type to text
  - Preserves existing values by casting integer → text

  ## Notes
  - Existing integer order numbers (e.g. 47) become text strings ("47")
  - New orders will receive formatted strings like "VO-260220-T2-AD-N-C-001"
  - The sequence is dropped as it is no longer needed
*/

ALTER TABLE voice_orders
  ALTER COLUMN order_number DROP DEFAULT;

ALTER TABLE voice_orders
  ALTER COLUMN order_number TYPE text USING order_number::text;
