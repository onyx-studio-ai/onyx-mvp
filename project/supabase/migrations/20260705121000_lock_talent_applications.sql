/*
  # S2 — 收緊 talent_applications:擋任一登入帳號讀光 / 竄改 / 刪除所有申請人 PII

  ## 問題
  原 migration(20260219222650)的 policy 是:
    - SELECT / UPDATE / DELETE 都 `TO authenticated USING(true)`
  等於平台上「任一登入帳號」(含配音員自助帳號、客戶帳號)都能:
    讀光所有申請人姓名 / email / 電話 / 國家 / 費率期望等 PII、改申請狀態、刪申請。

  ## 前端不直連(已 grep 驗證)
  app/ + components/ 內對 talent_applications 的存取全在 /api/*(service_role):
    apply/submit、apply/email-code、admin/applications、admin/talents/*、
    admin/voice-id、admin/liveness、admin/badges、talents/onboard、auth/reset-password。
  後台審核走 /api/admin/applications(service_role + requireAdmin),非前端直連。
  → 可安全鎖成「只 service_role 能讀 / 改 / 刪」。

  ## 送件也走後端(所以可全鎖)
  公開 /apply 申請表送件是打 /api/apply/submit → 用 service_role 寫入,並非前端 anon
  直接 INSERT。故連 INSERT 都不需開給 anon / authenticated,可整張只留 service_role,
  與 payout_requests / casting_invites 等敏感表一致(RLS on + 零對外 policy)。

  ## 這支做什麼
  - RLS 保持 ON。
  - 移除 SELECT / UPDATE / DELETE 的 `TO authenticated USING(true)` policy。
  - 移除舊的 anon/authenticated INSERT policy(送件走 service_role,不再需要)。
  - REVOKE ALL,只剩 service_role(表 owner,繞過 RLS)能存取。

  ## 冪等 / 保守
  DROP POLICY IF EXISTS + REVOKE ALL,可重複執行。純權限收緊,不動欄位 / 資料。
  ⚠️ 若擔心哪個路徑其實靠 anon 直接 INSERT,可先只跑「DROP 三條 SELECT/UPDATE/DELETE
     policy + REVOKE SELECT,UPDATE,DELETE」、保留 INSERT policy 觀察,再收 INSERT。
     但已 grep 確認送件走 /api/apply/submit(service_role),此處直接全鎖。
*/

ALTER TABLE talent_applications ENABLE ROW LEVEL SECURITY;

-- 移除會洩漏 / 可竄改的萬用 policy
DROP POLICY IF EXISTS "Authenticated admins can view all applications" ON talent_applications;
DROP POLICY IF EXISTS "Authenticated admins can update applications" ON talent_applications;
DROP POLICY IF EXISTS "Authenticated admins can delete applications" ON talent_applications;
-- 送件走 service_role API,anon INSERT policy 不再需要
DROP POLICY IF EXISTS "Anyone can submit an application" ON talent_applications;

-- 只剩 service_role 能碰
REVOKE ALL ON talent_applications FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
