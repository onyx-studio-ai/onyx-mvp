-- 2026-07-22 當日已在生產 DB 手動執行(Supabase SQL Editor,Wing 逐段回 Success)。
-- 本檔為 repo 記錄,讓新環境重建與生產一致(審查發現 repo/DB 漂移,補檔)。

-- ① 修改費(超過內含修改次數的加收費;配音員同意後才解鎖上傳)
alter table voice_orders
  add column if not exists revision_fee numeric,
  add column if not exists revision_fee_status text,
  add column if not exists revision_fee_total numeric not null default 0,
  add column if not exists revision_fee_agreed_at timestamptz;

-- ② 授權前置閘(AI 案要點,試音前必勾同意;同意時間落庫存證)
alter table marketplace_briefs add column if not exists license_summary text;
alter table marketplace_quotes add column if not exists license_agreed_at timestamptz;

-- ③ 案件語言可見度(配音員自選最多 5 個想看的案件語言;空 = 回落檔案 languages)
alter table talents add column if not exists visible_languages jsonb;

-- ④ 同角色多人並行指派(客戶換人場景):唯一鍵從 (brief, role) 放寬為 (brief, role, talent)。
--    舊鍵是 unique INDEX 不是 constraint(drop constraint 會報 42704)。
drop index if exists uq_voice_orders_brief_role;
create unique index if not exists uq_voice_orders_brief_role_talent
  on voice_orders (brief_id, role_name, talent_id);
