/*
  # Update Order Number Format to Structured VO- / MU- Format

  ## Summary
  Replaces the old ONYX-YYYYMMDD-XXXX and MUSIC-YYYYMMDD-XXXX formats with new
  structured formats that encode order metadata directly into the order number.

  ## New Formats

  ### Voice Orders: VO-{YYMMDD}{TierCode}{UsageCode}{BroadcastCode}{SeqNum}
  - Prefix: VO-
  - Date: YYMMDD (e.g., 260219)
  - TierCode:
      tier-1 / essential   → T1
      tier-2 / professional → T2
      tier-3 / premium      → T3
      (default)             → T0
  - UsageCode (use_case):
      Social Media / social-media → SM
      Advertisement               → AD
      Corporate / Internal        → CO
      Podcast                     → PD
      E-Learning                  → EL
      (default)                   → GN
  - BroadcastCode (broadcast_rights):
      true  → BC
      false → NI
  - SeqNum: 3-digit zero-padded daily sequence

  ### Music Orders: MU-{YYMMDD}{TierCode}{UsageCode}{StringCode}{SeqNum}
  - Prefix: MU-
  - Date: YYMMDD (e.g., 260219)
  - TierCode (tier):
      ai-curator      → AC
      pro-arrangement → PR
      masterpiece     → MS
      (default)       → GN
  - UsageCode (usage_type):
      Commercial Advertisement / commercial → CM
      Social Media Content / social-media  → SM
      Film/TV Production / film-tv         → FT
      Corporate / corporate                → CO
      Game / gaming                        → GM
      (default)                            → GN
  - StringCode (string_addon):
      intimate-ensemble   → IE
      rich-studio-strings → RS
      cinematic-symphony  → CS
      (none / null)       → NS
  - SeqNum: 3-digit zero-padded daily sequence

  ## Security
  - Functions use SET search_path = public for security
  - Triggers fire BEFORE INSERT only when order_number IS NULL
*/

-- ============================================================
-- VOICE ORDERS: new generate function
-- ============================================================
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  date_part    text;
  tier_code    text;
  usage_code   text;
  broadcast_code text;
  sequence_num text;
  new_order_number text;
BEGIN
  -- Date: YYMMDD
  date_part := to_char(NEW.created_at, 'YYMMDD');

  -- Tier code
  tier_code := CASE
    WHEN NEW.tier IN ('tier-1', 'essential')    THEN 'T1'
    WHEN NEW.tier IN ('tier-2', 'professional') THEN 'T2'
    WHEN NEW.tier IN ('tier-3', 'premium')      THEN 'T3'
    ELSE 'T0'
  END;

  -- Usage code
  usage_code := CASE
    WHEN lower(NEW.use_case) LIKE '%social%'       THEN 'SM'
    WHEN lower(NEW.use_case) LIKE '%advertis%'     THEN 'AD'
    WHEN lower(NEW.use_case) LIKE '%corporate%'
      OR lower(NEW.use_case) LIKE '%internal%'     THEN 'CO'
    WHEN lower(NEW.use_case) LIKE '%podcast%'      THEN 'PD'
    WHEN lower(NEW.use_case) LIKE '%e-learn%'
      OR lower(NEW.use_case) LIKE '%elearn%'       THEN 'EL'
    ELSE 'GN'
  END;

  -- Broadcast code
  broadcast_code := CASE
    WHEN NEW.broadcast_rights = true THEN 'BC'
    ELSE 'NI'
  END;

  -- Daily sequence (3-digit, padded)
  SELECT LPAD((COUNT(*) + 1)::text, 3, '0') INTO sequence_num
  FROM voice_orders
  WHERE created_at::date = NEW.created_at::date;

  new_order_number := 'VO-' || date_part || tier_code || usage_code || broadcast_code || sequence_num;

  NEW.order_number := new_order_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================================
-- MUSIC ORDERS: new generate function
-- ============================================================
CREATE OR REPLACE FUNCTION generate_music_order_number()
RETURNS TRIGGER AS $$
DECLARE
  date_part    text;
  tier_code    text;
  usage_code   text;
  string_code  text;
  sequence_num text;
  new_order_number text;
BEGIN
  -- Date: YYMMDD
  date_part := to_char(NEW.created_at, 'YYMMDD');

  -- Tier code
  tier_code := CASE
    WHEN NEW.tier = 'ai-curator'      THEN 'AC'
    WHEN NEW.tier = 'pro-arrangement' THEN 'PR'
    WHEN NEW.tier = 'masterpiece'     THEN 'MS'
    ELSE 'GN'
  END;

  -- Usage code
  usage_code := CASE
    WHEN lower(NEW.usage_type) LIKE '%commercial%'  THEN 'CM'
    WHEN lower(NEW.usage_type) LIKE '%social%'      THEN 'SM'
    WHEN lower(NEW.usage_type) LIKE '%film%'
      OR lower(NEW.usage_type) LIKE '%tv%'          THEN 'FT'
    WHEN lower(NEW.usage_type) LIKE '%corporate%'   THEN 'CO'
    WHEN lower(NEW.usage_type) LIKE '%game%'
      OR lower(NEW.usage_type) LIKE '%gaming%'      THEN 'GM'
    ELSE 'GN'
  END;

  -- String addon code
  string_code := CASE
    WHEN NEW.string_addon = 'intimate-ensemble'   THEN 'IE'
    WHEN NEW.string_addon = 'rich-studio-strings' THEN 'RS'
    WHEN NEW.string_addon = 'cinematic-symphony'  THEN 'CS'
    ELSE 'NS'
  END;

  -- Daily sequence (3-digit, padded)
  SELECT LPAD((COUNT(*) + 1)::text, 3, '0') INTO sequence_num
  FROM music_orders
  WHERE created_at::date = NEW.created_at::date;

  new_order_number := 'MU-' || date_part || tier_code || usage_code || string_code || sequence_num;

  NEW.order_number := new_order_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
