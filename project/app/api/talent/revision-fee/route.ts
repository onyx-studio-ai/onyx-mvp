import { NextRequest, NextResponse } from 'next/server';
import { resolveTalentFromRequest } from '@/lib/talent-auth';
import { sendEmail } from '@/lib/mail';

/*
  POST /api/talent/revision-fee { order_id } — 配音員同意本輪「加收修改費」。
  超過內含修改次數的修改,後台發修改需求時可掛一筆費用(revision_fee,
  status='pending');配音員必須先按同意(本 API),上傳區才解鎖。
  同意 = 費用滾進 revision_fee_total(總酬勞 = talent_price + revision_fee_total),
  agreed_at 落庫當協議證據,並通知製作部。(Wing 2026-07-21,女王百貨第二輪修改)
*/
export async function POST(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id, name');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const talent = r.talent as { id: string; name: string };

  let body: { order_id?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const orderId = String(body.order_id || '');
  if (!orderId) return NextResponse.json({ error: 'order_id required' }, { status: 400 });

  const { data: order } = await r.db.from('voice_orders')
    .select('id, order_number, project_name, role_name, talent_price, currency, revision_fee, revision_fee_status, revision_fee_total')
    .eq('id', orderId).eq('talent_id', talent.id).maybeSingle();
  if (!order) return NextResponse.json({ error: 'not your assigned order' }, { status: 403 });
  const fee = Number(order.revision_fee) || 0;
  if (order.revision_fee_status !== 'pending' || fee <= 0) {
    return NextResponse.json({ error: '這張單目前沒有待同意的修改費' }, { status: 400 });
  }

  const newTotal = (Number(order.revision_fee_total) || 0) + fee;
  const { error } = await r.db.from('voice_orders').update({
    revision_fee_status: 'agreed',
    revision_fee_total: newTotal,
    revision_fee_agreed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', order.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const cur = (order.currency || 'TWD') === 'USD' ? 'US$' : 'NT$';
  const grand = (Number(order.talent_price) || 0) + newTotal;
  sendEmail({
    category: 'PRODUCTION', to: 'produce@onyxstudios.ai',
    subject: `修改費已同意 · ${order.order_number}`,
    html: `<p>${talent.name} 已同意「${order.project_name || ''}${order.role_name ? ' · ' + order.role_name : ''}」本輪修改費 ${cur}${fee}。</p><p>累計修改費 ${cur}${newTotal},總酬勞 ${cur}${grand}。</p>`,
  }).catch(() => {});

  return NextResponse.json({ ok: true, revision_fee_total: newTotal });
}
