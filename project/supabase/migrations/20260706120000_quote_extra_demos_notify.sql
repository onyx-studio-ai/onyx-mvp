-- "想聽更多 demo" 通知/計數修補 (2026-07-06)
--
-- 背景:配音員上傳追加 demo 走的是 marketplace_quotes.extra_samples(jsonb 陣列)。
-- 為了讓 admin 側導覽能像其他項目一樣顯示「未讀」數字(badge),需要一個可直接在
-- SQL 過濾的時間戳記 —— jsonb 陣列內每筆的 created_at 無法直接 count/比對。
--
--   extra_samples_updated_at : 每次配音員 append 一段追加 demo 時就更新為 now()。
--                              /api/admin/badges 用 `> demos_since` 算出新上傳數,
--                              點進 /admin/marketplace 後 badge 歸零(沿用既有機制)。
--
-- 冪等:欄位用 IF NOT EXISTS;回填只寫「已有追加 demo 但戳記為空」的舊資料,可重複跑。

ALTER TABLE marketplace_quotes
  ADD COLUMN IF NOT EXISTS extra_samples_updated_at timestamptz;

-- 回填:已上傳過追加 demo 的舊紀錄,用 updated_at 當近似上傳時間,讓歷史資料不會
-- 因為戳記為空而永遠不被 badge 計入(也不會誤報成「新的」)。
UPDATE marketplace_quotes
SET extra_samples_updated_at = COALESCE(updated_at, created_at)
WHERE extra_samples_updated_at IS NULL
  AND jsonb_typeof(extra_samples) = 'array'
  AND jsonb_array_length(extra_samples) > 0;

-- badge 計數會掃這個欄位,建個部分索引讓查詢便宜(只索引真的有值的列)。
CREATE INDEX IF NOT EXISTS idx_marketplace_quotes_extra_samples_updated_at
  ON marketplace_quotes (extra_samples_updated_at)
  WHERE extra_samples_updated_at IS NOT NULL;
