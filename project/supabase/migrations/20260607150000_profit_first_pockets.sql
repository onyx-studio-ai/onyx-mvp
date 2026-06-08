/*
  # Phase 5 — Profit First Envelope Budgeting

  Wing's mental model (2026-06-07): each income gets split immediately
  into 6 named pockets so spending discipline is enforced at the
  allocation step instead of "look at the pool at month-end and hope
  there's profit left."

  Inspired by Mike Michalowicz's *Profit First* method.

  ## Pockets (sum = 100% of income)

  | Pocket          | %   | Purpose                                |
  |-----------------|-----|----------------------------------------|
  | talent          | 25% | Paid to voice actors                   |
  | marketing       |  7% | Ads, content, SEO                      |
  | operations      |  5% | Vercel, Supabase, software subs        |
  | studio          |  8% | Recording studio, equipment, hardware  |
  | reserve         |  5% | Tax buffer + emergency fund            |
  | profit          | 50% | Owner pay (Wing's actual take-home)    |

  ## Allocation trigger

  - Platform / client_deal income → on payment_received checkbox,
    allocate order_total across 6 pockets per their %
  - Buyout entries → on talent_paid checkbox, deduct payout from
    Talent pocket (buyout is an *outflow*, not income)

  ## Spending

  Wing manually creates spend transactions via /admin/pockets UI.

  ## Idempotency

  - IF NOT EXISTS guards on table creation
  - Seed uses ON CONFLICT DO NOTHING — re-running won't duplicate
    pockets, but also won't reset balances if Wing ever wants to
    tweak the %.
*/

CREATE TABLE IF NOT EXISTS pockets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  display_name_zh TEXT NOT NULL,
  allocation_percent NUMERIC(5,4) NOT NULL,
  emoji TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pocket_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pocket_id UUID NOT NULL REFERENCES pockets(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  type TEXT NOT NULL CHECK (type IN ('income_allocation', 'spend', 'buyout_outflow', 'adjustment')),
  source_earning_id UUID REFERENCES talent_earnings(id) ON DELETE SET NULL,
  description TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pocket_txns_pocket_id ON pocket_transactions(pocket_id);
CREATE INDEX IF NOT EXISTS idx_pocket_txns_occurred_at ON pocket_transactions(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_pocket_txns_source_earning_id ON pocket_transactions(source_earning_id)
  WHERE source_earning_id IS NOT NULL;

-- Seed the 6 pockets. ON CONFLICT DO NOTHING so re-running keeps
-- whatever percentages Wing may have tweaked later.
INSERT INTO pockets (name, display_name, display_name_zh, allocation_percent, emoji, sort_order)
VALUES
  ('talent',     'Talent Payout',         '配音員',         0.2500, '💼', 1),
  ('marketing',  'Marketing',             '行銷',           0.0700, '📢', 2),
  ('operations', 'Operations',            '營運',           0.0500, '⚙️', 3),
  ('studio',     'Studio / Equipment',    '錄音室 / 設備',  0.0800, '🎙', 4),
  ('reserve',    'Reserve (Tax / Buffer)','預備金 (稅 / 應急)', 0.0500, '📦', 5),
  ('profit',     'Profit / Owner Pay',    '利潤 / 老闆',    0.5000, '💰', 6)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE pockets ENABLE ROW LEVEL SECURITY;
ALTER TABLE pocket_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access on pockets"
  ON pockets FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access on pocket_transactions"
  ON pocket_transactions FOR ALL
  USING (true)
  WITH CHECK (true);
