-- Structured credits for search. Splits the single free-text `credits` into
-- queryable parts so a client can later search "Pepsi voice actor" / a brand /
-- an award and match talents by who they've worked with, not just bio prose.
--
-- location now stores a country KEY (see COUNTRIES in lib/talent-taxonomy),
-- availability_note stores comma-joined availability keys, studio_partner stores
-- a URL — all reuse existing text columns, so only the credit split is new here.
--
-- Additive + idempotent.

alter table public.talents
  add column if not exists clients        text,   -- 合作品牌 / 客戶 (comma-separated, feeds search)
  add column if not exists awards         text,   -- 獎項
  add column if not exists notable_works  text,   -- 代表作
  add column if not exists special_skills text;   -- 特殊技能 / 模仿 (impersonation, beatbox, dialects… feeds search)

notify pgrst, 'reload schema';
