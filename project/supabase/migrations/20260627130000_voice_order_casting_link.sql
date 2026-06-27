-- Link a production order back to the casting brief + winning quote it came from,
-- and store the client's requested submission/delivery date. Used by the
-- client-selected → build-order closure (Phase B): when a client picks an
-- audition we create a voice_order from the awarded quote. brief_id also lets us
-- guard against creating the order twice for the same case.
ALTER TABLE voice_orders ADD COLUMN IF NOT EXISTS brief_id uuid;
ALTER TABLE voice_orders ADD COLUMN IF NOT EXISTS quote_id uuid;
ALTER TABLE voice_orders ADD COLUMN IF NOT EXISTS deadline text;
CREATE INDEX IF NOT EXISTS idx_voice_orders_brief_id ON voice_orders(brief_id);
