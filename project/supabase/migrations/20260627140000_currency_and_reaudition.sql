-- (1) Currency on production orders, so finance can total by currency instead of
-- mixing TWD + USD into one wrong number. Defaults to USD (AI/music orders);
-- marketplace orders are backfilled from their winning quote's currency.
ALTER TABLE voice_orders ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';
UPDATE voice_orders vo
  SET currency = q.currency
  FROM marketplace_quotes q
  WHERE vo.quote_id = q.id AND q.currency IS NOT NULL AND q.currency <> '';

-- (2) Second-audition (二次試音): the client can ask a specific talent to re-record
-- before deciding. We store the ask on the quote; the talent re-uploads their
-- sample, which clears the request.
ALTER TABLE marketplace_quotes ADD COLUMN IF NOT EXISTS reaudition_note text;
ALTER TABLE marketplace_quotes ADD COLUMN IF NOT EXISTS reaudition_requested_at timestamptz;
