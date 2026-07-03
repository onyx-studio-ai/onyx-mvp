-- 驗證碼寄送記錄 —— 用於發送限流(同 email 60 秒一次、同 IP 每小時上限)。
-- 只由 service-role 後端寫入/查詢;RLS on 無 policy = 前端(anon)碰不到。
create table if not exists otp_send_log (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists otp_send_log_email_time_idx on otp_send_log (lower(email), created_at desc);
create index if not exists otp_send_log_ip_time_idx on otp_send_log (ip, created_at desc);

alter table otp_send_log enable row level security;
-- 無 policy:僅 service_role 可存取。
