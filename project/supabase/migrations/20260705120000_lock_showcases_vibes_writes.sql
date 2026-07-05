/*
  # S2 — 收緊 audio_showcases / vibes 的寫入(擋匿名塗改首頁 / 音樂展示)

  ## ⚠️ 執行順序(重要 —— 分兩步,先部署程式再跑此檔)
  這兩張表的寫入原本由前端 admin 頁「用 anon client 直寫」(admin 登入是應用層
  cookie,對 DB 而言是 anon 角色)。本輪已把 /admin/showcases、/admin/vibes 的寫入
  改走後端 service_role API(/api/admin/showcases、/api/admin/vibes,requireAdmin 授權)。

    → 必須「先把新版程式部署上線、確認後台存 / 改 / 刪 showcases 與 vibes 正常」,
      再跑這支 migration。順序反了 = 舊版前端還在 anon 直寫 → 後台上傳全部失敗。

  ## 這支做什麼
  - RLS 保持 ON。
  - 移除 anon(及誤設的 authenticated)的 INSERT / UPDATE / DELETE policy。
  - 【保留】公開 SELECT —— 首頁 FeaturedVoices / VoiceTierComparison、/music 各頁、
    VibesGrid 都是前端 anon client 直接 SELECT 這兩張表的公開展示資料,不可鎖。
  - REVOKE INSERT/UPDATE/DELETE(雙保險),保留 SELECT 給 anon / authenticated。
  - service_role 是表 owner,繞過 RLS、不受 REVOKE 影響,後端 API 照常運作。

  ## 冪等
  全部 DROP POLICY IF EXISTS + 明確 GRANT/REVOKE,重複執行無害。純權限收緊,不動資料。

  ## 註:儲存桶未在此處理
  showcases 儲存桶(音檔 / 封面實體檔)目前 anon 可寫,admin 頁仍走 anon 直接上傳到桶。
  收緊桶寫入需另外把上傳也改走 signed-upload-url(如 /api/hire/script-upload 的做法),
  屬後續增量,不在本 migration 範圍,以免弄壞現有上傳。
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- audio_showcases —— 保留公開 SELECT,移除所有匿名寫入
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE audio_showcases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon can insert audio_showcases" ON audio_showcases;
DROP POLICY IF EXISTS "Anon can update audio_showcases" ON audio_showcases;
DROP POLICY IF EXISTS "Anon can delete audio_showcases" ON audio_showcases;
-- 保留:"Anyone can view audio_showcases"(FOR SELECT USING(true))

-- 收回寫入權限、保留讀取(先全收再補回 SELECT,避免遺漏)
REVOKE ALL ON audio_showcases FROM anon, authenticated;
GRANT SELECT ON audio_showcases TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- vibes —— 保留公開 SELECT,移除寫入(原 migration 是 TO authenticated;
--          正式站若有漂移出的 anon 寫入 policy 也一併 DROP 掉)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE vibes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can insert vibes" ON vibes;
DROP POLICY IF EXISTS "Authenticated users can update vibes" ON vibes;
DROP POLICY IF EXISTS "Authenticated users can delete vibes" ON vibes;
-- 保險:若正式站曾手動加過 anon 寫入 policy(名稱未知的漂移),下列常見命名一併清掉
DROP POLICY IF EXISTS "Anon can insert vibes" ON vibes;
DROP POLICY IF EXISTS "Anon can update vibes" ON vibes;
DROP POLICY IF EXISTS "Anon can delete vibes" ON vibes;
-- 保留:"Anyone can view vibes"(FOR SELECT USING(true))

REVOKE ALL ON vibes FROM anon, authenticated;
GRANT SELECT ON vibes TO anon, authenticated;

-- PostgREST 重新載入權限 / schema 快取
NOTIFY pgrst, 'reload schema';
