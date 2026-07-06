/*
  # 移除廢棄的 vibes 表(音樂後台整合 方案 B — 塊一)

  ## 背景
  vibes 表原本由 /admin/vibes 後台管理,前台唯一讀它的 components/catalog/VibesGrid.tsx
  是沒有任何頁面 import 的死程式(整個 components/catalog/ 都是孤兒)。真正驅動前台
  音樂庫的是 audio_showcases(section='music_library')。本輪已在程式端移除:
    - app/[locale]/admin/vibes/page.tsx(後台頁)
    - app/api/admin/vibes/route.ts(後端 API)
    - components/catalog/(VibesGrid / TalentsGrid / CatalogAudioPlayer 孤兒元件)
    - 後台導覽列的 Vibes 連結
    - lib/supabase.ts 的 Vibe 型別

  ## ⚠️ 執行順序(重要)
  必須「先把移除以上程式的新版部署上線」,再跑這支 migration。
  順序反了 = 舊版前端 /admin/vibes 仍會嘗試讀 vibes 表 → 該頁報錯。
  (不過該頁本輪已刪,部署後即不存在,風險極低。)

  ## 這支做什麼
  DROP TABLE vibes。CASCADE 只會一併移除 vibes 自身的 RLS policy 與 index;
  已全域 grep 確認沒有任何其他資料表以 FK 參照 vibes,故 CASCADE 不會波及其他表。

  ## 冪等
  IF EXISTS,重複執行無害。

  ## 註:storage
  vibes 舊音檔 / 封面上傳到的是共用的 showcases 儲存桶(路徑前綴 vibes/…)。
  showcases 桶仍供 audio_showcases 使用,不可刪;桶內 vibes/ 前綴的舊檔可日後
  手動清理,不在本 migration 範圍(避免誤刪)。
*/

DROP TABLE IF EXISTS vibes CASCADE;

-- PostgREST 重新載入 schema 快取(移除已不存在的表)
NOTIFY pgrst, 'reload schema';
