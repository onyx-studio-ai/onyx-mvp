import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { platformConfigured, publishFacebook, publishInstagram, publishX, type PublishResult } from '@/lib/social/publish';

/*
  社群自動發文 cron(vercel.json,每天台北 20:00 = UTC 12:00 跑一次)。

  規則:
    • 撈 social_queue 裡 status='ready' 且 scheduled_for 已到(或 null)的**最早 1 筆**
      —— 一次只發一則,積壓也不洪水補發(照抄 Soluna 的節流設計)。
    • 對該列的 platforms 逐一發送,發送邏輯復用已上線的 /api/admin/social/*(見 lib/social/publish.ts)。
    • 全部成功 → status='posted' + posted_at + results(各平台連結)
      任一失敗   → status='failed' + error(**不自動重試**,人工看過再改回 ready)
      全部跳過   → status='skipped'
    • IG 強制要媒體:該列沒有 media_url 就跳過 IG、照發 FB,並在 results 註記。
    • 金鑰沒設 → 該平台優雅跳過(log + 回報),不 500。

  手動驗證:?dry=1 只回「下一則會發什麼」,不真的發、不改狀態。
*/

export const runtime = 'nodejs';
export const maxDuration = 60; // IG 影片 container 輪詢最久約 55 秒

type QueueRow = {
  id: string;
  kind: string;
  platforms: string[] | null;
  text: string | null;
  link: string | null;
  media_url: string | null;
  media_kind: string | null;
  source_id: string | null;
};

export async function GET(request: NextRequest) {
  // ── 授權(同 delivery-reminders:CRON_SECRET / x-vercel-cron / admin cookie)──
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') || '';
  const viaCronSecret = !!cronSecret && auth === `Bearer ${cronSecret}`;
  const viaVercelCron = !cronSecret && !!request.headers.get('x-vercel-cron');
  if (!viaCronSecret && !viaVercelCron) {
    const unauthorized = requireAdmin(request);
    if (unauthorized) return unauthorized;
  }

  const dry = new URL(request.url).searchParams.get('dry') === '1';
  const db = getSupabaseServiceClient();
  const nowIso = new Date().toISOString();

  // 最早到期的一筆(scheduled_for 為 null 視為「隨時可發」,排最前)
  const { data: rows, error } = await db.from('social_queue')
    .select('id, kind, platforms, text, link, media_url, media_kind, source_id')
    .eq('status', 'ready')
    .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso}`)
    .order('scheduled_for', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) {
    // migration 還沒跑之前先安靜待命,不讓 cron 報錯(同 delivery-reminders 的做法)
    if (/social_queue/.test(error.message)) return NextResponse.json({ ok: false, note: 'waiting for migration: social_queue' });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row = (rows || [])[0] as QueueRow | undefined;
  if (!row) return NextResponse.json({ ok: true, posted: 0, note: '沒有到期的待發貼文' });

  const platforms = (row.platforms || []).filter(Boolean);
  if (dry) {
    return NextResponse.json({ ok: true, dry: true, next: { id: row.id, kind: row.kind, platforms, text: row.text, link: row.link, media_url: row.media_url } });
  }

  const results: Record<string, unknown> = {};
  const failures: string[] = [];
  let succeeded = 0;

  for (const p of platforms) {
    // 金鑰沒設 → 優雅跳過(不算失敗,人補上金鑰後可把這列改回 ready 重發)
    if (!platformConfigured(p)) {
      results[p] = { skipped: `${p.toUpperCase()} 金鑰未設定,已跳過` };
      continue;
    }
    let r: PublishResult;
    if (p === 'fb') {
      // 有圖走 /photos(FB 會忽略 link,所以連結本來就寫在主文裡);無圖走 /feed 帶 link 卡片
      const imageUrl = row.media_kind === 'image' ? row.media_url || '' : '';
      r = await publishFacebook({ text: row.text || '', link: row.link || '', imageUrl });
    } else if (p === 'ig') {
      // 🚨 IG 強制要媒體:沒有就跳過 IG,其他平台照發
      if (!row.media_url) {
        results.ig = { skipped: 'IG 必須附圖片或影片,本則沒有媒體,已跳過' };
        continue;
      }
      r = await publishInstagram({ caption: row.text || '', mediaUrl: row.media_url, mediaType: row.media_kind === 'video' ? 'video' : 'image' });
    } else if (p === 'x') {
      r = await publishX({ text: row.text || '', linkReply: row.link || '' });
    } else {
      results[p] = { skipped: `未支援的平台 ${p}` };
      continue;
    }

    if (r.ok) {
      succeeded++;
      results[p] = { ok: true, url: r.url, id: r.id };
    } else {
      failures.push(`${p}: ${r.error}`);
      results[p] = { ok: false, error: r.error };
    }
  }

  // 任一失敗 → failed(不自動重試);全跳過 → skipped;其餘 → posted
  const status = failures.length ? 'failed' : succeeded ? 'posted' : 'skipped';
  await db.from('social_queue').update({
    status,
    results,
    error: failures.length ? failures.join(' | ') : null,
    posted_at: status === 'posted' ? new Date().toISOString() : null,
  }).eq('id', row.id);

  return NextResponse.json({ ok: !failures.length, id: row.id, kind: row.kind, status, results });
}
