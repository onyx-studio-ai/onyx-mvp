/*
  M3/M4 — certificates:客戶只讀自己的、匿名完全不可讀。

  ## 問題(安全審)
  原 policy:
    - "Authenticated users can manage certificates" FOR ALL TO authenticated USING(true)
      → 任一登入帳號可讀光 / 竄改 / 刪除所有憑證(含 client_email、配音員真名、pdf_url)。
    - "Anon can read certificates by license_id" FOR SELECT TO anon USING(true)
      → 名不符實,實為「匿名可列舉整張表」,配合可枚舉的舊編號 + 公開憑證桶 → 整批撈客戶名/
        專案/配音員真名 + PDF。
  客戶儀表板(/dashboard 授權書分頁)以登入客戶身分直讀自己的憑證(client_email 過濾),
  所以不能像申請表那樣全鎖,改成 email-scoped:客戶只讀自己 email 的。

  ## 這支做什麼
  - 移除上述兩條萬用 policy。
  - 新增 email-scoped SELECT:authenticated 只讀 client_email = 自己 JWT email 的列
    (對齊 voice_orders 既有 email-scoped 範式)。
  - anon 完全 REVOKE(驗證改走 /api/verify service_role;且編號已加亂碼防枚舉)。
  - authenticated 只留 SELECT(受 RLS 過濾),建/改/刪走 service_role API。
  冪等:DROP IF EXISTS + 明確 GRANT/REVOKE,可重複執行。純權限,不動資料。
*/

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage certificates" ON certificates;
DROP POLICY IF EXISTS "Anon can read certificates by license_id" ON certificates;

CREATE POLICY "clients read own certificates"
  ON certificates
  FOR SELECT
  TO authenticated
  USING (client_email = ((select auth.jwt()) ->> 'email'));

REVOKE ALL ON certificates FROM anon;
REVOKE INSERT, UPDATE, DELETE ON certificates FROM authenticated;
GRANT SELECT ON certificates TO authenticated;

NOTIFY pgrst, 'reload schema';
