-- Manual Order support — payment method/reference/notes for offline payments
-- (bank wire, Alipay, WeChat Pay, Wise, Payoneer, cash) on B2B orders
-- that bypass Paddle to avoid 5% fee on large amounts.
--
-- voice_orders + music_orders: add 3 new columns
-- orchestra_orders: add 2 new columns (already has payment_ref — alias in code)

-- ============================================================
-- voice_orders
-- ============================================================
ALTER TABLE voice_orders
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS payment_notes text;

COMMENT ON COLUMN voice_orders.payment_method IS
  'Payment channel: paddle | bank_transfer | alipay | wechat_pay | wise | payoneer | paypal | cash | other';
COMMENT ON COLUMN voice_orders.payment_reference IS
  'Bank transaction ref / Alipay tx / wire confirmation number — for offline reconciliation';
COMMENT ON COLUMN voice_orders.payment_notes IS
  'Free-text admin notes about the payment (e.g. "Received USD500 from 數據堂 via Alipay 對公 on 2026/5/21")';

CREATE INDEX IF NOT EXISTS idx_voice_orders_payment_method ON voice_orders(payment_method);

-- ============================================================
-- music_orders
-- ============================================================
ALTER TABLE music_orders
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS payment_notes text;

COMMENT ON COLUMN music_orders.payment_method IS
  'Payment channel: paddle | bank_transfer | alipay | wechat_pay | wise | payoneer | paypal | cash | other';
COMMENT ON COLUMN music_orders.payment_reference IS
  'Bank transaction ref / Alipay tx / wire confirmation number — for offline reconciliation';
COMMENT ON COLUMN music_orders.payment_notes IS
  'Free-text admin notes about the payment';

CREATE INDEX IF NOT EXISTS idx_music_orders_payment_method ON music_orders(payment_method);

-- ============================================================
-- orchestra_orders (already has payment_ref — repurpose as reference,
-- add the other two)
-- ============================================================
ALTER TABLE orchestra_orders
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_notes text;

COMMENT ON COLUMN orchestra_orders.payment_method IS
  'Payment channel: paddle | bank_transfer | alipay | wechat_pay | wise | payoneer | paypal | cash | other';
COMMENT ON COLUMN orchestra_orders.payment_ref IS
  'Bank transaction ref / Alipay tx / wire confirmation number — for offline reconciliation (existing column, repurposed)';
COMMENT ON COLUMN orchestra_orders.payment_notes IS
  'Free-text admin notes about the payment';

CREATE INDEX IF NOT EXISTS idx_orchestra_orders_payment_method ON orchestra_orders(payment_method);

-- ============================================================
-- Backfill: existing paid orders that have a transaction_id starting with
-- "txn_" came from Paddle. Mark them so admin can filter.
-- ============================================================
UPDATE voice_orders
SET payment_method = 'paddle'
WHERE payment_method IS NULL
  AND transaction_id IS NOT NULL
  AND transaction_id LIKE 'txn\_%' ESCAPE '\';

UPDATE voice_orders
SET payment_method = 'admin_manual'
WHERE payment_method IS NULL
  AND transaction_id IS NOT NULL
  AND transaction_id LIKE 'ADMIN-%';

UPDATE music_orders
SET payment_method = 'paddle'
WHERE payment_method IS NULL
  AND transaction_id IS NOT NULL
  AND transaction_id LIKE 'txn\_%' ESCAPE '\';

UPDATE music_orders
SET payment_method = 'admin_manual'
WHERE payment_method IS NULL
  AND transaction_id IS NOT NULL
  AND transaction_id LIKE 'ADMIN-%';
