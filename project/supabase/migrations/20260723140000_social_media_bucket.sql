/*
  # 建立 social-media 公開 storage bucket(FB/IG 一鍵發文用)

  ## 為何需要「公開」bucket
  Meta 的 Graph API 發圖/發影片時,只吃「公開可訪問的 URL」——
    - FB 粉專 /photos:body 帶 `url`,由 Facebook 伺服器端去抓那個 URL
    - IG /media:body 帶 `image_url` / `video_url`,由 Instagram 伺服器端去抓
  它們不接受直接上傳二進位檔,一定要先有一個外部可讀的 URL。

  ## 為何這裡開 public 不違反 M-2 私有化原則
  20260723120000 把 deliverables / talent-submissions 改私有,是因為那兩桶
  裝的是「客戶交付檔 / 配音員投稿」等不該公開的東西。
  本桶裝的是「即將公開發到 FB/IG 的行銷圖片與影片」——內容本來就要公開給全世界看,
  放 public bucket 沒有任何隱私損失,且是 Meta API 能抓到 URL 的最簡解。
  故此桶「刻意」public,與 M-2 的私有化用意不衝突。

  ## 規格
  - id/name: social-media
  - public: true
  - 檔案大小上限:200MB(IG Reels 可以到 100MB+,留餘裕)
  - 允許 MIME:常見圖片 + 常見影片(mp4/mov)

  ## 冪等
  ON CONFLICT DO UPDATE,重複執行安全。
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'social-media',
  'social-media',
  true,
  209715200,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/quicktime'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 209715200,
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/quicktime'
  ];

-- 只有後端(service role)會寫入;讀取靠 public。故只需一條 public 讀取政策。
-- service role 走 SUPABASE_SERVICE_ROLE_KEY,繞過 RLS,不需額外 INSERT policy。
CREATE POLICY "Public can read social media"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'social-media');
