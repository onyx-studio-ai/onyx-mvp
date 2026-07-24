-- 社群自動發文佇列(Onyx 雲端版:Vercel cron + Supabase,不抄 Soluna 的本機 Excel)
--
-- 流程:內容產生端(發案 / 之後的 blog / evergreen)寫一列進來 status='ready',
-- /api/cron/social-post 每天撈「最早到期的一筆」發出去,發完回寫狀態與各平台連結。
-- 一次只發一則 = 積壓不洪水補發(照抄 Soluna 的節流設計)。
--
-- 🔒 只由 service role(API route)讀寫:開 RLS 但不建任何 policy,
--    anon / authenticated 一律拒絕,service role 天生繞過 RLS。

create table if not exists social_queue (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null,                        -- 'casting' | 'blog' | 'evergreen'
  platforms     text[] not null default '{}',         -- 要發哪些平台,例:{fb,ig}
  text          text,                                 -- 貼文主文(FB message / IG caption / X text)
  link          text,                                 -- 導流連結(FB 當 link 卡片;X 發成第一則回覆)
  media_url     text,                                 -- 公開可讀的圖 / 影片 URL(IG 強制要)
  media_kind    text,                                 -- 'image' | 'video'
  status        text not null default 'ready',        -- ready | posted | failed | skipped
  source_id     text,                                 -- 來源識別:brief_id / blog slug…,用來防重複入列
  results       jsonb,                                -- 各平台結果:{ fb: {...}, ig: {...} }
  scheduled_for timestamptz,                          -- 預定發送時間;null = 立刻可發
  posted_at     timestamptz,
  error         text,                                 -- 失敗原因(人工看過再改回 ready,不自動重試)
  created_at    timestamptz not null default now()
);

-- 防重複入列:同一個 kind + 同一個來源只准一列(例:同一張發案單只會有一則招募貼文)。
-- source_id 為 null 的列(手動排的貼文)不受限。
create unique index if not exists social_queue_kind_source_uniq
  on social_queue (kind, source_id)
  where source_id is not null;

-- cron 的撈取條件:status='ready' 且 scheduled_for 已到(或 null)
create index if not exists social_queue_due_idx
  on social_queue (status, scheduled_for);

alter table social_queue enable row level security;
