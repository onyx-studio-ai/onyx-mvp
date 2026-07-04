import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  自建輕量流量埋點 —— 公開、輕量、絕不擋使用者。

  - POST 收 { path, locale, event?, visitorId }
  - 國家碼從 Vercel 自動帶的 header `x-vercel-ip-country` 取;隱私:只存國家、不存完整 IP。
  - 用 service client insert 一筆 page_views。任何錯誤一律吞掉(analytics 掛掉不能影響前台),永遠回 { ok: true }。
  - sanitize:所有欄位限長;event 只收白名單,其餘視為 pageview(避免前端亂塞髒事件名)。
*/

// 允許的事件名。非白名單 → 一律當 pageview。
const ALLOWED_EVENTS = new Set(['pageview', 'hire_submit', 'quote_submit', 'apply_submit']);

// 取字串 + 去空白 + 限長;拿不到就回 null。
function clip(v: unknown, max: number): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const path = clip(body.path, 300);
    const locale = clip(body.locale, 16);
    const visitorId = clip(body.visitorId, 64);
    const rawEvent = clip(body.event, 32);
    const event = rawEvent && ALLOWED_EVENTS.has(rawEvent) ? rawEvent : 'pageview';

    // Vercel edge 自動帶的地理 header;本地/非 Vercel 環境會是 null → 存 null 即可。
    const country = clip(request.headers.get('x-vercel-ip-country'), 8);

    const db = getSupabaseServiceClient();
    await db.from('page_views').insert([{ path, locale, country, visitor_id: visitorId, event }]);
  } catch {
    // 刻意吞掉:analytics 失敗不可影響使用者體驗。
  }
  return NextResponse.json({ ok: true });
}
