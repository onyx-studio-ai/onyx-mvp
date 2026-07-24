import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  手動排程社群貼文 —— 後台「社群發文」頁選「排程」時打這支,把一則貼文寫進
  social_queue(kind='manual', status='ready', 帶 scheduled_for),由 /api/cron/social-post
  每 10 分鐘巡一次,時間到就自動發。立即發布仍走原本各平台 /api/admin/social/* 不變。

  時區:前端(使用者機器=英國時間)先把選的時間轉成 UTC ISO 再傳來,
        本支只驗證 + 原樣存;不在伺服器端猜時區(Vercel 跑 UTC,若在這裡 new Date
        一個無時區字串會錯位)。

  防重複入列的 unique(kind, source_id) 只在 source_id 非 null 時生效,手動貼文 source_id=null 不受限。
*/

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_PLATFORMS = new Set(['x', 'fb', 'ig']);

// POST —— 排一則貼文進佇列
export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '請求格式錯誤' }, { status: 400 });
  }

  const platforms = Array.isArray(body.platforms)
    ? (body.platforms as unknown[]).filter((p): p is string => typeof p === 'string' && VALID_PLATFORMS.has(p))
    : [];
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const link = typeof body.link === 'string' ? body.link.trim() : '';
  const mediaUrl = typeof body.mediaUrl === 'string' ? body.mediaUrl.trim() : '';
  const mediaKind = body.mediaKind === 'video' ? 'video' : body.mediaKind === 'image' ? 'image' : null;
  const scheduledForRaw = typeof body.scheduledFor === 'string' ? body.scheduledFor.trim() : '';

  if (platforms.length === 0) return NextResponse.json({ error: '請至少選一個平台' }, { status: 400 });
  if (!text && !mediaUrl) return NextResponse.json({ error: '請先輸入主文或上傳媒體' }, { status: 400 });
  if (platforms.includes('ig') && !mediaUrl) return NextResponse.json({ error: 'IG 需要圖片或影片,請先上傳媒體' }, { status: 400 });

  // scheduled_for:空 = null(隨時可發);有值必須是可解析的時間(前端已轉 UTC ISO)
  let scheduledFor: string | null = null;
  if (scheduledForRaw) {
    const d = new Date(scheduledForRaw);
    if (Number.isNaN(d.getTime())) return NextResponse.json({ error: '排程時間格式錯誤' }, { status: 400 });
    scheduledFor = d.toISOString();
  }

  const db = getSupabaseServiceClient();
  const { data, error } = await db
    .from('social_queue')
    .insert({
      kind: 'manual',
      platforms,
      text: text || null,
      link: link || null,
      media_url: mediaUrl || null,
      media_kind: mediaUrl ? mediaKind || 'image' : null,
      status: 'ready',
      scheduled_for: scheduledFor,
      source_id: null,
    })
    .select('id, scheduled_for')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id, scheduled_for: data.scheduled_for });
}

// GET —— 列出待發 / 排程中的貼文(status='ready')
export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const db = getSupabaseServiceClient();
  const { data, error } = await db
    .from('social_queue')
    .select('id, kind, platforms, text, media_url, scheduled_for, created_at')
    .eq('status', 'ready')
    .order('scheduled_for', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) {
    // migration 未跑時安靜回空,不讓頁面爆
    if (/social_queue/.test(error.message)) return NextResponse.json({ ok: true, items: [] });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, items: data || [] });
}

// DELETE?id=… —— 取消一則待發貼文(status -> 'canceled',保留紀錄不硬刪)
export async function DELETE(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });

  const db = getSupabaseServiceClient();
  // 只取消還沒發的(status='ready'),已發/失敗的不動
  const { error } = await db.from('social_queue').update({ status: 'canceled' }).eq('id', id).eq('status', 'ready');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
