/*
  # S1 — RLS lockdown:擋匿名(anon)透過公開 anon key 直連 PostgREST 讀寫敏感表

  ## 背景(安全審已用 anon key 對正式站實測證實)
  前端 bundle 帶公開 anon key,任何人可繞過 /api 層直接打 Supabase PostgREST。
  下列多張表的 RLS policy 寫成 `FOR ALL USING (true)` 卻漏了 `TO service_role`,
  等於對「匿名 / 已登入」全開讀(部分可寫)。這些表全部只由後端 service_role
  API 存取(前端不直連,已逐表 grep app/ + components/ 驗證),因此:

    RLS 保持 ON + 移除那條萬用 policy → 只剩 service_role(繞過 RLS)能碰,
    與本專案 talent_payout_details / payout_requests 等敏感表一致。

  再加 `REVOKE` 收回 anon / authenticated 對表的直接權限(雙保險,即使日後
  誤加 policy 也擋得住;service_role 是表 owner / superuser,不受 REVOKE 影響)。

  ## 冪等
  全部用 `DROP POLICY IF EXISTS` + `enable row level security`(重複執行無害)。
  不 DROP 任何欄位 / 資料,純權限收緊。

  ## 特別處理(不是全鎖 —— 見各段註解)
  - marketplace_briefs / contact_inquiries:保留「匿名只能 INSERT」的原始設計
    (anon insert-only 不洩漏資料),只移除會洩漏的 `FOR ALL USING(true)`。
  - marketplace_reviews:原 migration 漏了 enable RLS(正式站手動開了 → 漂移),
    這裡補上 enable(冪等),消除 schema 漂移。
  - audio_showcases / vibes:此檔【不動】。前端 admin 頁面用 anon client 直接
    寫這兩張表(admin gate 是應用層 cookie,非 Supabase auth,對 DB 而言仍是
    anon 角色)。貿然收回寫入會弄壞 /admin/showcases、/admin/vibes 的上傳。
    公開展示頁需要 anon SELECT,也必須保留。改法見本輪回報的方案(改走 API +
    service_role),不在此 migration 內硬改。

  安全審已逐條審核 + 老闆親自套用。
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) casting_invites — 只後端 API 存取(token 伺服器端驗證)。零前端直連。
--    舊 policy:svc_full_cinvites  (FOR ALL USING(true))
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE casting_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "svc_full_cinvites" ON casting_invites;
REVOKE ALL ON casting_invites FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) marketplace_briefs — 後端 API 存取。
--    /hire 送件走 /api/hire(service_role insert),前端不直接 insert briefs,
--    但保留原設計的「匿名只能 INSERT」policy(insert-only 不洩漏既有資料)。
--    舊 policy:svc_full_briefs (FOR ALL USING(true)) → DROP(這條讓匿名可「讀」全部 briefs)
--             anon_insert_briefs (FOR INSERT TO anon)  → 保留
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE marketplace_briefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "svc_full_briefs" ON marketplace_briefs;
-- 收回 SELECT/UPDATE/DELETE(擋匿名讀取客戶 email / 內容),保留 INSERT 給表單。
REVOKE SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON marketplace_briefs FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) marketplace_quotes — 後端 API 存取。零前端直連。
--    舊 policy:svc_full_quotes (FOR ALL USING(true))
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE marketplace_quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "svc_full_quotes" ON marketplace_quotes;
REVOKE ALL ON marketplace_quotes FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) marketplace_messages — client↔talent 訊息。後端 API 授權後存取。零前端直連。
--    舊 policy:svc_full_messages (FOR ALL USING(true))
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE marketplace_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "svc_full_messages" ON marketplace_messages;
REVOKE ALL ON marketplace_messages FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) brief_messages — client↔Onyx 訊息。後端 API 授權後存取。零前端直連。
--    舊 policy:svc_full_briefmsg (FOR ALL USING(true))
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE brief_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "svc_full_briefmsg" ON brief_messages;
REVOKE ALL ON brief_messages FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) talent_earnings — 配音員收入 / 抽成(含 manual 案的隱藏成本 cost_breakdown)。
--    後端 API 存取。零前端直連。極敏感。
--    舊 policy:"Allow service role full access on talent_earnings" (FOR ALL USING(true))
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE talent_earnings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow service role full access on talent_earnings" ON talent_earnings;
REVOKE ALL ON talent_earnings FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7) payout_requests — 請款單。原 migration 已是「RLS on + 零 policy」的正確樣板,
--    這裡不需 DROP policy,只補 REVOKE 做雙保險。零前端直連。
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON payout_requests FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8) profit_first_pockets → 實際表名 pockets + pocket_transactions。
--    lib/pockets.ts 全部用 service_role client,零前端直連。
--    舊 policy:"Allow service role full access on pockets" / "... on pocket_transactions"
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE pockets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow service role full access on pockets" ON pockets;
REVOKE ALL ON pockets FROM anon, authenticated;

ALTER TABLE pocket_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow service role full access on pocket_transactions" ON pocket_transactions;
REVOKE ALL ON pocket_transactions FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9) contact_inquiries — 客戶詢問單(含姓名 / email / 內文 / 內部備註 / 回覆紀錄)。
--    /api/contact/send 走 service_role insert,前端不直接讀寫。
--    保留原設計「匿名只能 INSERT」(表單送出),移除會洩漏的 FOR ALL USING(true)。
--    舊 policy:service_role_full_access_inquiries (FOR ALL USING(true)) → DROP
--             anon_insert_inquiries (FOR INSERT TO anon)               → 保留
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE contact_inquiries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_full_access_inquiries" ON contact_inquiries;
-- 收回 SELECT/UPDATE/DELETE(擋匿名讀取所有詢問單),保留 INSERT 給聯絡表單。
REVOKE SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON contact_inquiries FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10) marketplace_reviews — 消除 schema 漂移:原 migration 漏了 enable RLS,
--     正式站是手動開的。這裡冪等補上,讓 migration 與正式站一致。
--     這張表由 /api/marketplace/reviews(service_role)存取;公開只透過該 API
--     取「client→talent」評分,不開放匿名直接 SELECT 整張表。
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE marketplace_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON marketplace_reviews FROM anon, authenticated;

-- PostgREST 重新載入權限 / schema 快取
NOTIFY pgrst, 'reload schema';
