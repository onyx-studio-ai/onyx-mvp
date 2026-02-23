-- Talent Earnings / Commission Tracking
CREATE TABLE IF NOT EXISTS talent_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  order_id UUID NOT NULL,
  order_type TEXT NOT NULL,
  order_number TEXT NOT NULL,
  tier TEXT NOT NULL,
  order_total NUMERIC NOT NULL DEFAULT 0,
  commission_rate NUMERIC NOT NULL DEFAULT 0.10,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  payout_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_talent_earnings_talent_id ON talent_earnings(talent_id);
CREATE INDEX IF NOT EXISTS idx_talent_earnings_order_id ON talent_earnings(order_id);
CREATE INDEX IF NOT EXISTS idx_talent_earnings_status ON talent_earnings(status);

ALTER TABLE talent_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access on talent_earnings"
  ON talent_earnings FOR ALL
  USING (true)
  WITH CHECK (true);
