/*
  # 撥款證明碼 payout_requests.certificate_code

  每筆撥款一組唯一證明碼(撥款單號),格式 ONYX-PAY-<invoice_number>-<8碼高熵亂碼>。
  尾碼防從序號往上枚舉整批撈配音員/金額(同 certificates.license_id 的做法)。

  在後台標「已撥款」時由 API 生成並寫入(idempotent:已有就沿用,不覆寫)。
  通知信、後台列表、會計對帳 CSV 都帶這個碼。

  idempotent:欄位不存在才加;UNIQUE 部分索引(只約束非 NULL,舊資料 NULL 不衝突)。
*/

ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS certificate_code text;

-- 唯一性只約束已生成的碼(NULL 允許多筆),避免舊資料 NULL 撞唯一約束。
CREATE UNIQUE INDEX IF NOT EXISTS idx_payout_requests_certificate_code
  ON payout_requests(certificate_code)
  WHERE certificate_code IS NOT NULL;

notify pgrst, 'reload schema';
