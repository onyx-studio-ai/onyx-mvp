/*
  # Payouts Phase 1 — manual earnings + cost breakdown + filing checklist

  ## Background
  Wing's payout flow has two distinct paths:

  1. **Platform orders** (`order_type` = 'voice' | 'music' | 'orchestra'):
     Auto-written by Paddle webhook. order_total is the real (public)
     amount the client paid. Commission rate stays at 25% — talent
     gets a transparent slice.

  2. **Manual/offline deals** (`order_type` = 'manual'):
     Wing keys in herself. Real client total may be USD 3M while
     talent payout is USD 300k — the difference covers Wing's
     marketing / platform fee / operations / margin. Talent must
     NEVER see the real total — only their payout.

  Wing's preferred filing pattern: store the actual PDFs locally on
  her Mac under ~/Desktop/Onyx_Accounting/, NOT in Supabase Storage
  (lower risk surface, simpler accountant handoff). The platform's
  job is reduced to:
   (a) recording the numbers (so accounting is reproducible)
   (b) prompting Wing with checkboxes — "have you put X in the
       folder yet?" — that block progress until all done

  ## Changes to `talent_earnings`

  - `cost_breakdown` JSONB
    For manual entries, stores Wing-only breakdown:
      { marketing: number, platform_fee: number,
        operations: number, other: number, notes: text }
    Platform orders leave this empty.

  - `local_folder_path` text — the suggested folder Wing should drop
    files into, e.g. "2026/Cases/Case_2026-001_Sierra_VoiceData_Q3"
    Generated when the manual entry is created.

  - 5 boolean/timestamp pairs for the filing checklist:
      contract_filed + contract_filed_at
      invoice_sent + invoice_sent_at
      payment_received + payment_received_at
      talent_paid + talent_paid_at
      delivered + delivered_at
    Each pair is "I confirm I put the corresponding file in the
    local folder". Wing ticks the box after dropping the file; the
    platform records the timestamp.

  Idempotent (IF NOT EXISTS guards).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'talent_earnings' AND column_name = 'cost_breakdown'
  ) THEN
    ALTER TABLE talent_earnings ADD COLUMN cost_breakdown JSONB DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'talent_earnings' AND column_name = 'local_folder_path'
  ) THEN
    ALTER TABLE talent_earnings ADD COLUMN local_folder_path text;
  END IF;

  -- Checklist pairs (boolean + timestamptz each)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talent_earnings' AND column_name = 'contract_filed') THEN
    ALTER TABLE talent_earnings ADD COLUMN contract_filed boolean NOT NULL DEFAULT false;
    ALTER TABLE talent_earnings ADD COLUMN contract_filed_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talent_earnings' AND column_name = 'invoice_sent') THEN
    ALTER TABLE talent_earnings ADD COLUMN invoice_sent boolean NOT NULL DEFAULT false;
    ALTER TABLE talent_earnings ADD COLUMN invoice_sent_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talent_earnings' AND column_name = 'payment_received') THEN
    ALTER TABLE talent_earnings ADD COLUMN payment_received boolean NOT NULL DEFAULT false;
    ALTER TABLE talent_earnings ADD COLUMN payment_received_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talent_earnings' AND column_name = 'talent_paid') THEN
    ALTER TABLE talent_earnings ADD COLUMN talent_paid boolean NOT NULL DEFAULT false;
    ALTER TABLE talent_earnings ADD COLUMN talent_paid_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talent_earnings' AND column_name = 'delivered') THEN
    ALTER TABLE talent_earnings ADD COLUMN delivered boolean NOT NULL DEFAULT false;
    ALTER TABLE talent_earnings ADD COLUMN delivered_at timestamptz;
  END IF;
END $$;

-- Index on order_type for filtering "all manual" / "all platform"
CREATE INDEX IF NOT EXISTS idx_talent_earnings_order_type
  ON talent_earnings(order_type);

-- Index on local_folder_path (only when populated) for searching by case
CREATE INDEX IF NOT EXISTS idx_talent_earnings_local_folder_path
  ON talent_earnings(local_folder_path)
  WHERE local_folder_path IS NOT NULL;
