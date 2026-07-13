import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/**
 * 流量埋點寫入端 — 前台每次頁面瀏覽由 <PageViewTracker> beacon 打這支。
 *
 * 設計原則:
 *   - Node runtime(預設):要用 service_role client 寫入受 RLS 鎖定的 page_views 表,
 *     不走 Edge(Edge 用 node supabase-js 不穩)。
 *   - 隱私最小化:只存 path / country(2 碼) / referrer host / locale。
 *     不碰 IP、不碰任何 PII。
 *   - 非阻塞 / 永不擋頁面:任何錯誤都吞掉回 204,絕不讓埋點失敗影響使用者。
 *   - 伺服器端二次過濾:即使前端漏擋,這裡也擋掉 /api、/admin、靜態資源、明顯 bot。
 */

export const runtime = 'nodejs';

// 這些前綴不算「訪客流量」:後台自己、API、驗證 / 結帳中繼、靜態資源。
const EXCLUDED_PREFIXES = [
  '/admin',
  '/api',
  '/_next',
  '/auth',
  '/checkout',
  '/paddle-checkout',
  '/verify',
  '/verify-voice',
  '/voice-id',
];

// 明顯的 bot / 爬蟲 / 監控 UA(小寫比對子字串)。抓不完但擋掉大宗雜訊。
const BOT_UA = [
  'bot', 'crawler', 'spider', 'crawl', 'slurp', 'mediapartners',
  'headless', 'phantom', 'puppeteer', 'playwright', 'lighthouse',
  'pingdom', 'uptime', 'monitor', 'curl', 'wget', 'python-requests',
  'axios', 'go-http', 'facebookexternalhit', 'preview',
];

function isBot(ua: string): boolean {
  const lower = ua.toLowerCase();
  return BOT_UA.some((sig) => lower.includes(sig));
}

function isExcludedPath(path: string): boolean {
  return EXCLUDED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/** 只取來源網域 host(不留 query / path),截斷防過長。空 / 站內來源回 null。 */
function refererHost(referrer: string | null, selfHost: string): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname;
    if (!host || host === selfHost) return null; // 站內導覽不算「來源」
    return host.slice(0, 128);
  } catch {
    return null;
  }
}

/** 只允許已知語系,其餘正規化成預設 en(避免存進髒值)。 */
function normalizeLocale(locale: unknown): string {
  return locale === 'zh-TW' || locale === 'zh-CN' ? locale : 'en';
}

export async function POST(request: NextRequest) {
  try {
    const ua = request.headers.get('user-agent') || '';
    if (isBot(ua)) return new NextResponse(null, { status: 204 });

    let body: { path?: unknown; locale?: unknown; referrer?: unknown } = {};
    try {
      body = await request.json();
    } catch {
      return new NextResponse(null, { status: 204 });
    }

    const rawPath = typeof body.path === 'string' ? body.path : '';
    // 只留 path 部分(去掉可能夾帶的 query / hash),截斷防過長。
    const path = rawPath.split('?')[0].split('#')[0].slice(0, 512);
    if (!path || !path.startsWith('/') || isExcludedPath(path)) {
      return new NextResponse(null, { status: 204 });
    }

    // 國家碼由 Vercel 邊緣注入(非我們解析 IP)。本機開發時不存在 → null。
    const country =
      request.headers.get('x-vercel-ip-country')?.slice(0, 2).toUpperCase() || null;

    const selfHost = (() => {
      try {
        return new URL(request.url).hostname;
      } catch {
        return 'www.onyxstudios.ai';
      }
    })();
    const referrer = refererHost(
      typeof body.referrer === 'string' ? body.referrer : null,
      selfHost,
    );

    const supabase = getSupabaseServiceClient();
    // fire-and-forget:不 await 的話 serverless 可能提前結束,所以 await。錯誤不擋頁面
    // (仍回 204),但要 console.error 出來 —— 之前純吞錯,害 page_views 缺欄位(PGRST204)
    // 導致每筆寫入靜默失敗、埋點斷了一週都沒人發現(2026-07-13)。留 log 讓 Vercel 看得到。
    const { error } = await supabase.from('page_views').insert({
      path,
      country,
      referrer,
      locale: normalizeLocale(body.locale),
    });
    if (error) console.error('[track] page_views insert failed:', error.code, error.message);

    return new NextResponse(null, { status: 204 });
  } catch {
    // 埋點永遠不能拖垮任何東西 — 靜默成功。
    return new NextResponse(null, { status: 204 });
  }
}
