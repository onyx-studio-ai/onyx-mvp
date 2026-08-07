-- 客服泡泡「漏答收集」(Wing 2026-08-06):Aria 本地 FAQ 答不出的問題自動存檔,
-- 滾動式補 QA 用。僅 service role 讀寫(RLS 開、無 policy)。
create table if not exists support_missed_questions (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  locale text,
  top_match text,          -- 當下最接近的 FAQ 題(可能為空=完全沒中)
  score int,               -- 最高比對分
  created_at timestamptz not null default now()
);
alter table support_missed_questions enable row level security;
