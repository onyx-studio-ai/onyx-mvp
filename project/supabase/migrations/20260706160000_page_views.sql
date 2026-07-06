-- 訪客流量埋點 (page_views)
--
-- 目的:平台原本完全沒有訪客流量數據(dashboard 只畫訂單數)。這張表輕量記錄
-- 每次前台頁面瀏覽,讓後台能看總量 / 熱門頁 / 國家分布 / 每日趨勢,支撐 data-driven 衝轉換。
--
-- 隱私(刻意最小化,非個人追蹤):
--   * 不存完整 IP、不存任何 PII(姓名 / email / user id / session id 都沒有)。
--   * country 只存 Vercel 邊緣給的 2 碼國家碼(x-vercel-ip-country),非精確定位。
--   * referrer 只留來源網域 host(截斷 128 字),不留 query string / path。
--   * 純聚合分析用。GDPR 上屬「不可辨識個人」的匿名統計。
--
-- RLS:enable RLS 但「不建 policy」= 只有 service_role(後端 API)能存取。
--   寫入走 /api/track(service_role insert),讀取走 /api/admin/traffic(service_role)。
--   前端 anon / 一般登入使用者一律讀不到、也寫不進(擋刷量)。
--   與專案其他敏感表(platform_costs / payout details 等)lockdown 寫法一致。

create table if not exists public.page_views (
  id         uuid primary key default gen_random_uuid(),
  path       text not null,                    -- 已去 locale 前綴的頁面路徑,例:/voices、/pricing
  country    text,                             -- 2 碼國家碼(來自 x-vercel-ip-country),可為 null
  referrer   text,                             -- 來源網域 host only(無 query / path),可為 null
  locale     text,                             -- 造訪語系:en / zh-TW / zh-CN
  created_at timestamptz not null default now()
);

-- 查詢用索引:趨勢(時間)、熱門頁(path)、國家分布(country)。
create index if not exists idx_page_views_created_at on public.page_views (created_at desc);
create index if not exists idx_page_views_path       on public.page_views (path);
create index if not exists idx_page_views_country    on public.page_views (country);

alter table public.page_views enable row level security;
-- 刻意不建任何 policy:僅 service_role 後端可存取。
-- 雙保險:收回 anon / authenticated 對表的直接權限(即使日後誤加 policy 也擋得住)。
revoke all on public.page_views from anon, authenticated;

-- PostgREST 重新載入 schema 快取
notify pgrst, 'reload schema';
