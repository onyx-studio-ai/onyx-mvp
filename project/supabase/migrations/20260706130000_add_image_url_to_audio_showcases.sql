/*
  # audio_showcases 加 image_url 欄位(音樂後台整合 方案 B — 塊二)

  ## 背景
  塊二讓 /admin/showcases 後台能管理前台音樂庫(audio_showcases.section='music_library')。
  每首曲目的「曲名 / 分類 / 描述」用現成欄位即可對應:
    - label       → 曲名
    - subtitle    → 分類(genre)
    - description → 風格描述
    - tags        → 決定歸在 instrumental / vocal 分頁(前台既有邏輯)
    - sort_order  → 排序
  唯一放不下的是「封面圖 URL」——現有欄位都另有用途。故新增 image_url 一欄。

  ## 為何需要
  前台 /music/catalog 原本封面是「寫死」約定路徑
    music-samples/covers/{slot_key}.jpg
  (不在 DB、靠 slot_key 硬湊)。後台要能自己換封面 → 需要一個地方存後台上傳的封面 URL。
  前台改為:image_url 有值就用它,沒值才 fallback 回上述寫死路徑
  → 既有 20 幾首舊封面照常顯示,不會因為遷移而空掉。

  ## 影響範圍
  純新增一個 nullable 欄位,固定 slot 區塊(featured_voices / voice_tier /
  music_comparison / orchestra_comparison)不填、維持 null,完全不受影響。

  ## 冪等
  ADD COLUMN IF NOT EXISTS,重複執行無害。
*/

ALTER TABLE audio_showcases
  ADD COLUMN IF NOT EXISTS image_url text;

-- PostgREST 重新載入 schema 快取(讓新欄位可被 API 讀寫)
NOTIFY pgrst, 'reload schema';
