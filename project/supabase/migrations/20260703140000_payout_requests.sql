/*
  # 請款單 payout_requests

  配音員發起的每一次請款。系統依他填好的收款資料(talent_payout_details)自動
  生成一張發票給他確認,他同意 + 簽名上傳(或上傳自家公司發票)。金額 = 請款額
  (gross);實際稅/手續費在後台依 lib/payout-policy 試算,撥款以會計為準。

  RLS 開、無 policy = 只有 service_role(後端 API)能存取。配音員只透過
  session 綁定的伺服器端 API 存取自己的請款單,絕不外洩。
*/

CREATE TABLE IF NOT EXISTS payout_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id      uuid NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,                 -- 系統給的發票編號 ONX-INV-...
  amount         numeric NOT NULL DEFAULT 0,    -- 請款額 gross
  currency       text NOT NULL DEFAULT 'USD',
  note           text,                          -- 配音員備註(選填)
  invoice_type   text NOT NULL DEFAULT 'generated', -- 'generated'(系統生成後簽名) | 'own'(自家公司發票)
  invoice_url    text,                          -- 上傳的簽名發票 / 自家發票檔
  consent_at     timestamptz,                   -- 配音員同意以此開立發票的時間
  status         text NOT NULL DEFAULT 'pending', -- pending | invoice_uploaded | paid | rejected
  admin_note     text,
  paid_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payout_requests_talent ON payout_requests(talent_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);

ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;
-- 故意不建 policy:service_role 繞過 RLS,其餘一律拒絕。

notify pgrst, 'reload schema';
