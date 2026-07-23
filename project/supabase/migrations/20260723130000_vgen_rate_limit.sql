-- 免費試聽防濫用限流(/api/voice/generate)
-- 未登入用戶每 IP 每天 5 次;計數存這張小表,靠 RPC 原子遞增。
-- 表只由 service role 經 RPC 讀寫,前端(anon/authenticated)完全碰不到。

create table if not exists api_daily_hits (
  bucket text not null,          -- 計數桶,例:'vgen:1.2.3.4'
  day    date not null,          -- 以資料庫日期為準的「當天」
  hits   int  not null default 0,
  primary key (bucket, day)
);

-- 開 RLS 且不建任何 policy:anon/authenticated 直接查表一律拒絕,
-- service role 天生繞過 RLS 不受影響。
alter table api_daily_hits enable row level security;

-- 原子計數:插入或 +1,回傳「加完後」的當日次數。
-- security definer → 以函式擁有者權限執行,呼叫端不需要對表有權限。
create or replace function bump_daily_hit(p_bucket text)
returns int
language sql
security definer
set search_path = public
as $$
  insert into api_daily_hits (bucket, day, hits)
  values (p_bucket, current_date, 1)
  on conflict (bucket, day)
  do update set hits = api_daily_hits.hits + 1
  returning hits;
$$;

-- 函式建立時預設 grant execute to public;全部收回,只留 service role 可呼叫,
-- 避免前端拿 anon key 直接灌爆計數(或反過來幫別人清額度)。
revoke execute on function bump_daily_hit(text) from public;
revoke execute on function bump_daily_hit(text) from anon;
revoke execute on function bump_daily_hit(text) from authenticated;
grant execute on function bump_daily_hit(text) to service_role;
