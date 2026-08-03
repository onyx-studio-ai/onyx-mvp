import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  admin 代客戶留評價(Onyx 以客戶身分評配音員)——聚合/站外案客戶不上平台,由平台代評。
  寫入 marketplace_reviews reviewer_type='client' + by_admin=true(立刻公開,不受雙盲/14天)。
  overall rating = 有給的子評分平均。一單一則 client 評(order_id+reviewer_type 唯一)→ upsert 可改。
*/
export async function POST(request: NextRequest) {
  const unauth = requireAdmin(request);
  if (unauth) return unauth;

  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  const orderId = String(b.order_id || '');
  if (!orderId) return NextResponse.json({ error: 'missing order_id' }, { status: 400 });

  const clamp = (v: unknown) => { const n = Math.round(Number(v)); return n >= 1 && n <= 5 ? n : null; };
  const comm = clamp(b.communication), qual = clamp(b.quality), deliv = clamp(b.delivery);
  const subs = [comm, qual, deliv].filter((x): x is number => x != null);
  if (!subs.length) return NextResponse.json({ error: '請至少給一個評分(1–5)' }, { status: 400 });
  const overall = Math.round(subs.reduce((a, c) => a + c, 0) / subs.length);

  const db = getSupabaseServiceClient();
  const { data: order } = await db.from('voice_orders').select('id, talent_id, brief_id').eq('id', orderId).maybeSingle();
  if (!order) return NextResponse.json({ error: '找不到訂單' }, { status: 404 });
  if (!order.talent_id) return NextResponse.json({ error: '此訂單沒有配音員,無法評價' }, { status: 400 });

  const row = {
    order_id: orderId,
    brief_id: order.brief_id ?? null,
    talent_id: order.talent_id,
    reviewer_type: 'client',
    rating: overall,
    rating_communication: comm,
    rating_quality: qual,
    rating_delivery: deliv,
    comment: String(b.comment || '').slice(0, 2000) || null,
    by_admin: true,
  };
  const { error } = await db.from('marketplace_reviews').upsert(row, { onConflict: 'order_id,reviewer_type' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rating: overall });
}
