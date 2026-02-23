/*
  # Add rights_level to voice_orders

  Replaces the single boolean broadcast_rights with a cumulative 3-tier rights system:
  - 'standard': Standard Commercial (YouTube/Social) — included in all tiers
  - 'broadcast': Broadcast TV & Buyout — add-on for tier-1 and tier-2, included in tier-3
  - 'global': Global TV & Game Rights — add-on for tier-1 and tier-2, included in tier-3

  The broadcast_rights column is retained for backward compatibility.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voice_orders' AND column_name = 'rights_level'
  ) THEN
    ALTER TABLE voice_orders ADD COLUMN rights_level text NOT NULL DEFAULT 'standard'
      CHECK (rights_level IN ('standard', 'broadcast', 'global'));
  END IF;
END $$;

-- Backfill existing orders: if broadcast_rights was true, set to broadcast
UPDATE voice_orders
SET rights_level = 'broadcast'
WHERE broadcast_rights = true AND rights_level = 'standard';
