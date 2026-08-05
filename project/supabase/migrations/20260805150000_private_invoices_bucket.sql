-- 發票私有化(Wing 2026-08-05)。⚠️ 已全部用 storage admin API 套到 production,本檔供新環境重現/留痕。
--
-- 背景:配音員請款簽名發票(含姓名/身分證字號)與營運成本單據原本都塞在「公開」casting 桶
-- (invoices/、admin-cost-invoices/ 前綴),發票是永久公開網址 = 個資外露;且 8/3 幫 casting
-- 設 mime 白名單時只放音檔,誤傷了發票與稿件上傳(casting 其實是多用途桶:交付音檔、客戶
-- 稿件 pdf/docx/xlsx、admin 參考音/附件)。
--
-- 最終狀態:
--   ① 新「私有」invoices 桶:請款發票(payout/{talentId}/)+ 成本單據(admin-cost-invoices/),
--      只收 pdf/圖檔、20MB;檢視一律走短效簽名網址(talent GET /api/talent/invoice-upload?id=、
--      admin /api/admin/payout-requests/signed-url、costs 同款)。
--   ② casting 桶恢復「不限型別」(8/3 前狀態)——多用途桶靠 size 上限守門,不設 mime 白名單。
--   ③ 歷史檔已搬移(4 張請款發票 + 14 張成本單據),payout_requests.invoice_url 改存 storage path。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoices', 'invoices', false, 20971520,
        array['application/pdf','image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = 20971520,
      allowed_mime_types = array['application/pdf','image/png','image/jpeg','image/webp'];

update storage.buckets
set allowed_mime_types = null,      -- 不限型別(恢復 8/3 前);大小仍 500MB
    file_size_limit = 524288000
where id = 'casting';
