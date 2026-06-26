/*
  # Casting: case-level voice specs (accent / style / voice age)

  Voices.com-style job data fields, surfaced on our casting cards. Most already
  exist on marketplace_briefs (length=規模, deadline=交付截止, media_scope=使用範圍,
  territory=地區, license_term=授權, audition_deadline=試音截止). These three are
  the missing case-level voice requirements — used mainly for single-voice calls
  (ads / narration / IVR), where the case (not a role) defines the voice.

  - accent       (text) — required accent, e.g. "台灣國語" / "大陸普通話" / "粵語"
  - voice_style  (text) — tone / delivery style, e.g. "對話自然" / "權威" / "溫暖"
  - voice_age    (text) — target voice age, e.g. "青年" / "中年" / "兒童"

  Additive + idempotent.
*/
ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS accent      text;
ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS voice_style text;
ALTER TABLE marketplace_briefs ADD COLUMN IF NOT EXISTS voice_age   text;
