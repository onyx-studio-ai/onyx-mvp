import { NextRequest, NextResponse } from 'next/server';
import { resolveTalentFromRequest } from '@/lib/talent-auth';
import { sendEmail } from '@/lib/mail';

/*
  POST /api/talent/assigned-deliver { order_id, delivery_url, file_name } — deliver
  against a DIRECTLY-ASSIGNED production order (managed casting; no quote, no client
  payment gate). Verified as the talent's own assigned order. Adds a version + flags
  the order 'delivered' for Onyx to QC in the admin order workflow.
*/
export async function POST(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id, name');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const talent = r.talent as { id: string; name: string };

  let body: { order_id?: string; delivery_url?: string; file_name?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const orderId = String(body.order_id || '');
  const url = String(body.delivery_url || '').slice(0, 1000);
  const name = String(body.file_name || '').slice(0, 200) || (url.split('/').pop()?.split('?')[0] || 'delivery');
  if (!orderId || !url) return NextResponse.json({ error: 'order_id and delivery_url required' }, { status: 400 });
  if (!/^https?:\/\//i.test(url)) return NextResponse.json({ error: 'invalid delivery_url' }, { status: 400 });

  const { data: order } = await r.db.from('voice_orders').select('id, status, talent_id, order_number').eq('id', orderId).eq('talent_id', talent.id).maybeSingle();
  if (!order) return NextResponse.json({ error: 'not your assigned order' }, { status: 403 });
  if (order.status === 'completed') return NextResponse.json({ error: '已完成無法再上傳。' }, { status: 400 });

  const { count } = await r.db.from('voice_order_versions').select('id', { count: 'exact', head: true }).eq('voice_order_id', order.id);
  const { error } = await r.db.from('voice_order_versions').insert({
    voice_order_id: order.id, file_url: url, file_name: name, notes: '配音員交付(指派)',
    version_number: (count || 0) + 1, status: 'pending_review',
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await r.db.from('voice_orders').update({ download_url: url, status: 'delivered', updated_at: new Date().toISOString() }).eq('id', order.id);

  // Onyx QCs assigned deliveries in the admin order workflow (no client email — this
  // is a managed production, not a client-posted case).
  sendEmail({ category: 'PRODUCTION', to: 'produce@onyxstudios.ai', subject: `指派角色交付 · ${order.order_number}`, html: `<p>${talent.name} 交付了指派角色 ${order.order_number}。</p><p><a href="https://www.onyxstudios.ai/admin/orders">後台驗收 →</a></p>` }).catch(() => {});
  return NextResponse.json({ ok: true });
}
