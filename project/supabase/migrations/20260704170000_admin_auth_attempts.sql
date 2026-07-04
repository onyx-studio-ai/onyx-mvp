-- M2 — admin 登入的 IP 級失敗限流記錄。
-- 每次「以 code 嘗試登入失敗」寫一筆;POST 前先數同 IP 近 15 分鐘的失敗數,
-- 超過門檻就擋(429),防止對 /api/admin/auth 暴力猜 ADMIN_CODE / PRODUCTION_CODE。
-- 成功登入不寫(不佔額度);只記失敗。與 otp_send_log 同套「service_role 專用」模式:
-- RLS on + 零 policy → 前端(anon)完全碰不到,只有後端 service_role 讀寫。
create table if not exists admin_auth_attempts (
  id uuid primary key default gen_random_uuid(),
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists admin_auth_attempts_ip_time_idx on admin_auth_attempts (ip, created_at desc);

alter table admin_auth_attempts enable row level security;
-- 故意不建 policy:僅 service_role 可存取。

notify pgrst, 'reload schema';
