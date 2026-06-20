/*
  # Fix order_number generation race/deletion collisions (VO + MU)

  Same bug as application_number: both active order-number functions used
  COUNT(*) + 1 for the daily sequence, which collides on concurrent inserts and
  after row deletions. Switch to MAX(existing daily suffix) + 1 (deletion-safe)
  guarded by a per-day transaction advisory lock (concurrency-safe). Number
  FORMAT is unchanged (VO-/MU- + codes + 3-digit sequence).
*/

-- VOICE ORDERS
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  date_part      text;
  tier_code      text;
  usage_code     text;
  broadcast_code text;
  seq_int        integer;
  sequence_num   text;
  new_order_number text;
BEGIN
  date_part := to_char(NEW.created_at, 'YYMMDD');

  tier_code := CASE
    WHEN NEW.tier IN ('tier-1', 'essential')    THEN 'T1'
    WHEN NEW.tier IN ('tier-2', 'professional') THEN 'T2'
    WHEN NEW.tier IN ('tier-3', 'premium')      THEN 'T3'
    ELSE 'T0'
  END;

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

  broadcast_code := CASE
    WHEN NEW.broadcast_rights = true THEN 'BC'
    ELSE 'NI'
  END;

  PERFORM pg_advisory_xact_lock(hashtext('voice_order_' || NEW.created_at::date::text));
  SELECT COALESCE(MAX(RIGHT(order_number, 3)::int), 0) + 1
  INTO seq_int
  FROM voice_orders
  WHERE created_at::date = NEW.created_at::date;
  sequence_num := LPAD(seq_int::text, 3, '0');

  new_order_number := 'VO-' || date_part || tier_code || usage_code || broadcast_code || sequence_num;
  NEW.order_number := new_order_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- MUSIC ORDERS
CREATE OR REPLACE FUNCTION generate_music_order_number()
RETURNS TRIGGER AS $$
DECLARE
  date_part    text;
  tier_code    text;
  usage_code   text;
  string_code  text;
  seq_int      integer;
  sequence_num text;
  new_order_number text;
BEGIN
  date_part := to_char(NEW.created_at, 'YYMMDD');

  tier_code := CASE
    WHEN NEW.tier = 'ai-curator'      THEN 'AC'
    WHEN NEW.tier = 'pro-arrangement' THEN 'PR'
    WHEN NEW.tier = 'masterpiece'     THEN 'MS'
    ELSE 'GN'
  END;

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

  string_code := CASE
    WHEN NEW.string_addon = 'intimate-ensemble'   THEN 'IE'
    WHEN NEW.string_addon = 'rich-studio-strings' THEN 'RS'
    WHEN NEW.string_addon = 'cinematic-symphony'  THEN 'CS'
    ELSE 'NS'
  END;

  PERFORM pg_advisory_xact_lock(hashtext('music_order_' || NEW.created_at::date::text));
  SELECT COALESCE(MAX(RIGHT(order_number, 3)::int), 0) + 1
  INTO seq_int
  FROM music_orders
  WHERE created_at::date = NEW.created_at::date;
  sequence_num := LPAD(seq_int::text, 3, '0');

  new_order_number := 'MU-' || date_part || tier_code || usage_code || string_code || sequence_num;
  NEW.order_number := new_order_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
