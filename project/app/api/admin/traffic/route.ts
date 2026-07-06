import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient, supabaseErrorResponse } from '@/lib/supabase-server';
import { requireAdminOnly } from '@/app/api/admin/_utils/requireAdmin';

/**
 * 流量儀表板資料 — admin role only(與 /api/admin/stats 一致,production 角色看不到)。
 *
 * 回傳:
 *   - totalViews:總瀏覽數(近 N 天,預設 30)
 *   - approxVisitors:近似獨立訪客(以 path+country+day 去重粗估;沒存 IP/PII 只能粗估)
 *   - topPages:熱門頁排序
 *   - countries:國家分布(老闆最關心美歐佔比)
 *   - dailyViews:每日趨勢
 *   - funnel:頁面瀏覽 → 詢價(contact_inquiries)→ 訂單(voice+music paid)三段
 *
 * 所有聚合在 Node 端做(資料量小、輕量;避免為此加 DB view / RPC 的過度工程)。
 */

export const runtime = 'nodejs';

const WINDOW_DAYS = 30;

type PageViewRow = {
  path: string;
  country: string | null;
  created_at: string;
};

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;

  try {
    const supabase = getSupabaseServiceClient();

    const since = new Date();
    since.setDate(since.getDate() - WINDOW_DAYS);
    const sinceIso = since.toISOString();

    // page_views(近 30 天),contact_inquiries 與訂單只要「筆數」→ 用 head+count 省流量。
    const [
      { data: views },
      { count: inquiryCount },
      { count: voicePaidCount },
      { count: musicPaidCount },
    ] = await Promise.all([
      supabase
        .from('page_views')
        .select('path, country, created_at')
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(50000),
      supabase
        .from('contact_inquiries')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', sinceIso),
      supabase
        .from('voice_orders')
        .select('id', { count: 'exact', head: true })
        .eq('payment_status', 'completed')
        .gte('created_at', sinceIso),
      supabase
        .from('music_orders')
        .select('id', { count: 'exact', head: true })
        .eq('payment_status', 'completed')
        .gte('created_at', sinceIso),
    ]);

    const rows: PageViewRow[] = (views as PageViewRow[]) || [];
    const totalViews = rows.length;

    // 熱門頁 top 10
    const pathCount: Record<string, number> = {};
    // 國家分布
    const countryCount: Record<string, number> = {};
    // 每日趨勢(YYYY-MM-DD)
    const dailyCount: Record<string, number> = {};
    // 近似獨立訪客:path+country+day 去重(無 IP → 只能這樣粗估)
    const visitorKeys = new Set<string>();

    for (const r of rows) {
      pathCount[r.path] = (pathCount[r.path] || 0) + 1;
      const c = r.country || 'Unknown';
      countryCount[c] = (countryCount[c] || 0) + 1;
      const day = r.created_at.slice(0, 10);
      dailyCount[day] = (dailyCount[day] || 0) + 1;
      visitorKeys.add(`${r.path}|${c}|${day}`);
    }

    const topPages = Object.entries(pathCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, views]) => ({ path, views }));

    const countries = Object.entries(countryCount)
      .sort((a, b) => b[1] - a[1])
      .map(([country, views]) => ({
        country,
        views,
        percentage: totalViews > 0 ? Math.round((views / totalViews) * 100) : 0,
      }));

    // 每日趨勢:補滿近 30 天(含 0 的日子),由舊到新。
    const dailyViews: Array<{ day: string; views: number }> = [];
    const cursor = new Date(since);
    const today = new Date();
    while (cursor <= today) {
      const key = cursor.toISOString().slice(0, 10);
      dailyViews.push({ day: key, views: dailyCount[key] || 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    const orders = (voicePaidCount || 0) + (musicPaidCount || 0);

    return NextResponse.json({
      windowDays: WINDOW_DAYS,
      totalViews,
      approxVisitors: visitorKeys.size,
      topPages,
      countries,
      dailyViews,
      funnel: {
        views: totalViews,
        inquiries: inquiryCount || 0,
        orders,
      },
    });
  } catch (err) {
    return supabaseErrorResponse(err, 'admin/traffic');
  }
}
