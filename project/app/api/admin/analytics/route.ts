import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOnly } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient, supabaseErrorResponse } from '@/lib/supabase-server';

/*
  後台流量儀表板資料來源(自建輕量 analytics)。

  流量屬敏感營運資料 → 用 requireAdminOnly(production 角色擋掉),與 costs / payouts 一致。

  聚合策略:
  - 只抓「近 30 天」視窗內、且只選需要的欄位(created_at/path/locale/country/visitor_id/event),
    不拉全表;30 天視窗讓列數有界,再在記憶體內分組計數(Supabase JS 無現成 GROUP BY)。
  - 回傳:今日 & 近 7 天的「不重複訪客數 + 總 pageviews」;熱門頁 Top 10;語系分布;
    國家分布 Top 10;三種轉換事件(hire/quote/apply)今日 & 7 天數。
*/

type Row = {
  created_at: string;
  path: string | null;
  locale: string | null;
  country: string | null;
  visitor_id: string | null;
  event: string | null;
};

// 依 key 累加計數,回傳排序後的 [ {key,count} ] Top N。
function topCounts(rows: Row[], pick: (r: Row) => string | null, limit?: number): { key: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = pick(r);
    if (!k) continue;
    map.set(k, (map.get(k) || 0) + 1);
  }
  const arr = [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
  return limit ? arr.slice(0, limit) : arr;
}

// 一批列裡的「不重複訪客數」+「總 pageviews」。
function summarize(rows: Row[]): { visitors: number; pageviews: number } {
  const visitors = new Set<string>();
  let pageviews = 0;
  for (const r of rows) {
    if (r.event === 'pageview') pageviews += 1;
    if (r.visitor_id) visitors.add(r.visitor_id);
  }
  return { visitors: visitors.size, pageviews };
}

const CONVERSION_EVENTS = ['hire_submit', 'quote_submit', 'apply_submit'] as const;

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;

  try {
    const now = Date.now();
    const since30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    // 今日 = 過去 24 小時(以滾動視窗算,不用當地午夜切,避免時區問題)。
    const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

    const db = getSupabaseServiceClient();
    const { data, error } = await db
      .from('page_views')
      .select('created_at, path, locale, country, visitor_id, event')
      .gte('created_at', since30)
      .order('created_at', { ascending: false })
      .limit(100000); // 安全上限,避免異常暴量把記憶體吃爆。
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data || []) as Row[];
    const rows24h = rows.filter((r) => r.created_at >= since24h);
    const rows7d = rows.filter((r) => r.created_at >= since7d);

    // 只用 pageview 列算熱門頁/語系/國家(轉換事件不進頁面統計,避免污染)。
    const pv7d = rows7d.filter((r) => r.event === 'pageview');

    const today = summarize(rows24h);
    const week = summarize(rows7d);

    const countEvents = (src: Row[]) =>
      Object.fromEntries(
        CONVERSION_EVENTS.map((e) => [e, src.filter((r) => r.event === e).length])
      ) as Record<(typeof CONVERSION_EVENTS)[number], number>;

    const conversionsToday = countEvents(rows24h);
    const conversions7d = countEvents(rows7d);

    return NextResponse.json({
      today: { visitors: today.visitors, pageviews: today.pageviews, conversions: conversionsToday },
      week: { visitors: week.visitors, pageviews: week.pageviews, conversions: conversions7d },
      topPages: topCounts(pv7d, (r) => r.path, 10),
      locales: topCounts(pv7d, (r) => r.locale),
      countries: topCounts(pv7d, (r) => r.country, 10),
      totalConversionsToday: CONVERSION_EVENTS.reduce((s, e) => s + conversionsToday[e], 0),
    });
  } catch (err) {
    return supabaseErrorResponse(err, 'admin/analytics GET');
  }
}
