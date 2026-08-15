import { NextRequest, NextResponse } from 'next/server';
import { resolveTalentFromRequest } from '@/lib/talent-auth';
import { webPushConfigured } from '@/lib/webpush';

/*
  Talent-side 網頁推播訂閱管理。
    GET    → { configured, publicKey, subscribed } — 前端拿 VAPID 公鑰 + 目前狀態
    POST   → { subscription } 存訂閱(同 endpoint 覆蓋;每人上限 5 裝置,舊的先出)
    DELETE → { endpoint? } 移除指定裝置訂閱;不帶 endpoint = 全部移除
  (需 migration:talents.push_subscriptions)
*/

type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function GET(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id, push_subscriptions');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const t = r.talent as { push_subscriptions?: PushSub[] | null };
  return NextResponse.json({
    configured: webPushConfigured(),
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || null,
    subscriptions: (t.push_subscriptions || []).map((s) => s.endpoint),
  });
}

export async function POST(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id, push_subscriptions');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const t = r.talent as { id: string; push_subscriptions?: PushSub[] | null };
  let body: { subscription?: PushSub };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const sub = body.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return NextResponse.json({ error: 'invalid subscription' }, { status: 400 });
  const next = [...(t.push_subscriptions || []).filter((s) => s.endpoint !== sub.endpoint), { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }].slice(-5);
  const { error } = await r.db.from('talents').update({ push_subscriptions: next }).eq('id', t.id);
  if (error) return NextResponse.json({ error: '尚未啟用(缺 migration)' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id, push_subscriptions');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const t = r.talent as { id: string; push_subscriptions?: PushSub[] | null };
  let endpoint = '';
  try { endpoint = String((await request.json())?.endpoint || ''); } catch { /* no body = clear all */ }
  const next = endpoint ? (t.push_subscriptions || []).filter((s) => s.endpoint !== endpoint) : [];
  await r.db.from('talents').update({ push_subscriptions: next }).eq('id', t.id);
  return NextResponse.json({ ok: true });
}
