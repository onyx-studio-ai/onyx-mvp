-- 公開徵集(open call)投稿表(Wing 2026-08-07):3000 人 LINE 群免登入投 Freetalk demo,
-- 綁四個 TTS 方言案。僅 service role 讀寫(RLS 開、無 policy)。
create table if not exists opencall_submissions (
  id uuid primary key default gen_random_uuid(),
  campaign text not null default 'dialects-2026-08',   -- 活動 slug(lib/opencall-campaigns.ts)
  name text not null,
  email text not null,
  phone text,
  messenger_app text,      -- line / wechat / whatsapp(台灣LINE/大陸微信/香港WhatsApp)
  messenger_id text,
  cases text[] not null default '{}',       -- 應徵案 code 清單
  demos jsonb not null default '[]',        -- [{case, url, name}] 每檔綁語系(Wing:檔案必須知道是哪個語)
  native_language text,    -- 母語/從小講的語言(人才庫關鍵欄位)
  accent text,             -- 口音(如:泉州腔)
  location text,           -- 現居地(城市/地區)
  expected_fee text,       -- 期望酬勞(自由報價,選填)
  referrer text,           -- 推薦人(選填;推薦獎私下談,頁面不寫)
  note text,
  status text not null default 'new',       -- new / shortlisted / picked / passed
  admin_note text,
  created_at timestamptz not null default now()
);
create index if not exists opencall_submissions_email_idx on opencall_submissions (email);
alter table opencall_submissions enable row level security;
