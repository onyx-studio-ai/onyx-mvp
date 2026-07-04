-- 自建輕量流量分析 (page_views)
--
-- 目的:後台「流量」儀表板的資料來源。前端每次換頁 beacon 一筆 pageview,
-- 關鍵轉換(詢價/報價/報名送出成功)另打一筆事件。不接第三方分析,自己存自己算。
--
-- 隱私:只存「國家碼」(從 Vercel 的 x-vercel-ip-country header 取)+ 匿名 visitor_id
--       (前端 localStorage 隨機 uuid,非個資),絕不存完整 IP、不存 user-agent、不綁帳號。
--
-- RLS:enable 但「不建 policy」= 只有 service_role(後端 API)能存取,
--      前端 anon / 一般登入使用者一律讀不到。與專案其他敏感表一致。

create table if not exists public.page_views (
  id         uuid primary key default gen_random_uuid(),
  path       text,                          -- 頁面路徑(已去掉 query),例:/zh-TW/voices
  locale     text,                          -- 語系:en / zh-TW / zh-CN
  country    text,                          -- 國家碼(ISO2,如 TW / US),隱私:不存完整 IP
  visitor_id text,                          -- 匿名訪客 id(前端 localStorage 隨機 uuid)
  event      text,                          -- pageview / hire_submit / quote_submit / apply_submit
  created_at timestamptz default now()
);

alter table public.page_views enable row level security;
-- 刻意不建任何 policy:僅 service_role 後端可存取。

-- 聚合查詢用的索引:時間範圍過濾 + 熱門頁 + 事件分組。
create index if not exists page_views_created_at_idx on public.page_views (created_at desc);
create index if not exists page_views_path_idx       on public.page_views (path);
create index if not exists page_views_event_idx      on public.page_views (event);
