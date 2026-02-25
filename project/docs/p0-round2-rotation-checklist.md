# P0 第二輪：金鑰輪替與驗證清單

## 0) 先決條件
- [ ] Supabase 目標專案已確認（project ref 與正式環境一致）
- [ ] 已可登入 Vercel 專案 `onyx-platform`
- [ ] 已確認目前變更窗口可接受短暫重部署

## 1) Supabase RLS Migration 生效確認
- [ ] 在 Supabase SQL Editor 執行 migration（若尚未執行）
  - 檔案：`supabase/migrations/20260223213000_p0_lockdown_admin_payment_rls.sql`
- [ ] 驗證以下 policy 已存在（共 6 條）
  - `p0_voice_orders_update_service_only`
  - `p0_music_orders_update_service_only`
  - `p0_orchestra_orders_update_service_only`
  - `p0_deliverables_insert_service_only`
  - `p0_deliverables_update_service_only`
  - `p0_deliverables_delete_service_only`

## 2) 金鑰輪替範圍
- [ ] TapPay
  - [ ] `NEXT_PUBLIC_TAPPAY_APP_ID`
  - [ ] `NEXT_PUBLIC_TAPPAY_PARTNER_KEY`
  - [ ] `TAPPAY_PARTNER_KEY`
  - [ ] `TAPPAY_MERCHANT_ID`
- [ ] Supabase
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`（通常不變）
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Resend
  - [ ] `RESEND_API_KEY`
- [ ] Admin
  - [ ] `ADMIN_CODE`

## 3) 同步流程（每一項都做）
- [ ] 在供應商後台產生新值
- [ ] 更新本機 `.env`
- [ ] 同步到 Vercel Production
- [ ] 觸發部署（或重新部署）使新環境變數生效
- [ ] 驗證成功後停用舊金鑰

## 4) 驗證清單
- [ ] 管理登入（`ADMIN_CODE`）可成功登入，舊值失效
- [ ] 金流建立訂單流程可走通（TapPay）
- [ ] Server 端需要 service role 的路徑正常（Supabase service role）
- [ ] 前台讀取需要 anon key 的路徑正常（Supabase anon）
- [ ] 郵件寄送成功（Resend）
- [ ] RLS 防護驗證：非 service role 更新 `voice_orders`/`music_orders`/`orchestra_orders` 被拒絕
- [ ] RLS 防護驗證：非 service role 寫入 `deliverables` bucket 被拒絕

## 5) 建議執行順序
1. 先完成並驗證 Supabase migration 生效
2. 先輪替 `ADMIN_CODE`（風險最低、快速驗證）
3. 依序輪替 `Resend`、`Supabase`、`TapPay`
4. 全面驗證後，正式停用所有舊金鑰
