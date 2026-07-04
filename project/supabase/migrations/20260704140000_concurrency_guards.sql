-- 併發防護:唯一索引兜底(concurrency guards)
--
-- 背景:目前「一案一單」「驗收記帳去重」是靠「先 SELECT 再 INSERT」的讀後寫,
-- 連點兩下 / 多裝置同時操作在極短時間內可能繞過檢查、重複建單 / 重複記帳。
-- 這支 migration 加 DB 層唯一索引當最後一道防線 —— 就算應用層去重漏掉,
-- DB 也會擋掉第二筆重複寫入(第二個 INSERT 直接報 unique violation)。
--
-- ⚠️ 執行前提醒:若現有資料「已經」有重複,建立唯一索引會直接失敗報錯。
--   若下面任一 CREATE UNIQUE INDEX 報 "could not create unique index ... duplicate key",
--   代表該表已有重複資料,需先人工清理重複列(保留一筆、刪其餘)再重跑本 migration。
--   偵測重複的查詢(執行前可先跑來確認):
--     -- voice_orders 同 brief 同角色的重複:
--     select brief_id, role_name, count(*)
--       from voice_orders
--       where brief_id is not null and role_name is not null
--       group by brief_id, role_name having count(*) > 1;
--     -- talent_earnings 同訂單的重複:
--     select order_id, count(*)
--       from talent_earnings
--       where order_id is not null
--       group by order_id having count(*) > 1;
--
-- 註:不用 CREATE UNIQUE INDEX CONCURRENTLY —— 它不能在交易區塊(migration)內執行。
--     這兩張表資料量小,一般 CREATE 的短暫鎖表可接受。

-- ① voice_orders:同一 brief 的同一角色只能有一張製作單。
--    用 partial index,只在 brief_id 與 role_name 都非 null 時生效:
--    - role_name is null(非 casting 的單人 / 一般單)不受此索引約束,可正常多筆;
--    - brief_id is null(不綁 brief 的直購單)同樣不受約束。
--    避免 NULL 互不相等(SQL 語意)導致的「假重複放行」誤擋正常情況。
create unique index if not exists uq_voice_orders_brief_role
  on voice_orders (brief_id, role_name)
  where brief_id is not null and role_name is not null;

-- ② talent_earnings:同一訂單只能記帳一次(order_id 為訂單主鍵 UUID)。
--    加 where order_id is not null 保險(現行 schema 為 NOT NULL,防日後放寬)。
create unique index if not exists uq_talent_earnings_order_id
  on talent_earnings (order_id)
  where order_id is not null;
