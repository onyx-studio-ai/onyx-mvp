-- 營運工具 / 每月費用清單 (platform_costs) + 月結發票 (platform_cost_invoices)
--
-- 目的:讓後台一眼看清每個月支撐平台要付哪些工具的錢、要不要升級,並能自己增刪改。
-- 每個工具還能逐月上傳發票,月結時一鍵打包給會計。
--
-- RLS:兩張表都 enable RLS 但「不建 policy」= 只有 service_role(後端 API)能存取,
-- 前端 anon / 一般登入使用者一律讀不到。與專案其他敏感表(payout details 等)一致。

-- ── 1) 每月費用清單 ───────────────────────────────────────────────
create table if not exists public.platform_costs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                 -- 工具名,例如 Supabase
  category      text,                          -- 類別:資料庫/部署/Email/GPU/網域/金流/分析/其他
  plan          text,                          -- 目前方案,例如 Free / Pro
  monthly_cost  numeric,                       -- 每月費用,可為 null = 未填 / 不適用
  currency      text default 'USD',            -- 幣別,全站只用 TWD / USD
  billing_cycle text default 'monthly',        -- monthly / yearly / usage(按量)/ free
  renewal_date  text,                          -- 續費日,自由文字
  url           text,                          -- 管理後台連結
  status        text default 'active',         -- active 使用中 / review 待評估升級 / inactive 已停用
  note          text,
  sort_order    int default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table public.platform_costs enable row level security;
-- 刻意不建任何 policy:僅 service_role 後端可存取。

-- ── 2) 月結發票 ──────────────────────────────────────────────────
create table if not exists public.platform_cost_invoices (
  id          uuid primary key default gen_random_uuid(),
  cost_id     uuid not null,                   -- 對應 platform_costs.id
  period      text not null,                   -- 月份 'YYYY-MM'
  invoice_url text not null,                   -- 發票檔連結(存 casting bucket 的 admin-cost-invoices/ 前綴)
  file_name   text,
  uploaded_at timestamptz default now()
);

alter table public.platform_cost_invoices enable row level security;
-- 同上:不建 policy,僅 service_role 後端可存取。

-- ── 3) Seed ──────────────────────────────────────────────────────
-- 用 where not exists (依 name) 防止 migration 被重跑時重複塞。
-- 金額只填確定的;其餘 monthly_cost 留 null(=待填)。
insert into public.platform_costs (name, category, plan, monthly_cost, currency, billing_cycle, status, note, url, sort_order)
select v.name, v.category, v.plan, v.monthly_cost, v.currency, v.billing_cycle, v.status, v.note, v.url, v.sort_order
from (values
  ('Supabase',        '資料庫·儲存', 'Pro',  25::numeric, 'USD', 'monthly', 'active', '已升 Pro,US$25/月,已付款', 'https://supabase.com/dashboard', 10),
  ('Vercel',          '部署',        null,   null::numeric, 'USD', 'monthly', 'active', 'Onyx 網站託管',                                'https://vercel.com',            20),
  ('RunPod',          'GPU 運算',    null,   null::numeric, 'USD', 'usage',   'active', '語音訓練/推論,餘額制按用量',                  null,                             30),
  ('Resend',          'Email',       null,   null::numeric, 'USD', 'monthly', 'active', '平台寄信,已驗證網域 onyxstudios.ai',          null,                             40),
  ('onyxstudios.ai',  '網域',        null,   null::numeric, 'USD', 'yearly',  'active', '網域註冊年費',                                 null,                             50),
  ('Paddle',          '金流',        null,   null::numeric, 'USD', 'usage',   'active', '收款,非月費、按交易抽成',                      null,                             60),
  ('Telegram Bot',    '通知',        'Free', 0::numeric,   'USD', 'free',    'active', 'OnyxStudiosBot 配音員通知,免費',              null,                             70),
  ('PostHog',         '分析',        null,   null::numeric, 'USD', 'monthly', 'active', '流量/產品分析',                                null,                             80)
) as v(name, category, plan, monthly_cost, currency, billing_cycle, status, note, url, sort_order)
where not exists (
  select 1 from public.platform_costs pc where pc.name = v.name
);
