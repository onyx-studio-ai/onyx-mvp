import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/mail';
import { createOrderFromAward } from '@/lib/casting-to-order';
import { castingAwardedTalentEmail, castingOrderClientEmail, castingOrderInternalEmail } from '@/lib/mail-templates';

/*
  POST /api/client/requests/[id]/select { quote_id, final_script, delivery_date? }
  — the CLIENT picks an audition AND closes it into a production order (Phase B).

  In one step: marks the chosen quote accepted + the brief awarded, collects the
  FINAL script + requested delivery date, and creates a voice_order (status
  pending_payment) from the winning quote (client pays gross; talent_price = net;
  talent assigned). Onyx then collects payment (manual confirm / Paddle later) and
  the order flows through the existing /dashboard production pipeline. Talent payout
  is handled OFFLINE by Onyx (monthly) — no platform split is charged here.

  Emails: the won talent, the client (order created · awaiting payment), produce@.
  Owner-gated; only while the case is still auditioning (status='open').
*/
const SITE = 'https://www.onyxstudios.ai';

async function owner(request: NextRequest, id: string) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { error: 'Not authenticated', status: 401 as const };
  const db = getSupabaseServiceClient();
  const { data: userData, error } = await db.auth.getUser(token);
  const email = userData?.user?.email;
  if (error || !email) return { error: 'Invalid session', status: 401 as const };
  const { data: brief } = await db.from('marketplace_briefs')
    .select('id, brief_number, status, client_email, client_name, title, content_type, language, brief, locale')
    .eq('id', id).maybeSingle();
  if (!brief) return { error: 'Not found', status: 404 as const };
  if (String(brief.client_email || '').toLowerCase() !== email.toLowerCase()) return { error: 'Not your request', status: 403 as const };
  return { db, brief };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await owner(request, id);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.brief.status !== 'open') return NextResponse.json({ error: '此案目前無法選定(可能尚未開放徵選或已選定)。' }, { status: 400 });

  let b: { quote_id?: string; final_script?: string; final_script_url?: string; delivery_date?: string };
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const quoteId = String(b.quote_id || '').trim();
  if (!quoteId) return NextResponse.json({ error: 'quote_id is required' }, { status: 400 });
  const finalScript = String(b.final_script || '').trim();
  const finalScriptUrl = String(b.final_script_url || '').trim();
  if (finalScriptUrl && !/^https?:\/\//i.test(finalScriptUrl)) return NextResponse.json({ error: 'invalid script file url' }, { status: 400 });
  if (!finalScript && !finalScriptUrl) return NextResponse.json({ error: '請提供正式稿件(貼上或上傳檔案),我們才能開始製作。' }, { status: 400 });
  const deliveryDate = String(b.delivery_date || '').trim().slice(0, 60) || undefined;

  // The quote must belong to this brief.
  const { data: q } = await r.db.from('marketplace_quotes')
    .select('id, brief_id, talent_id, gross_amount, net_amount, currency, included_revisions')
    .eq('id', quoteId).maybeSingle();
  if (!q || q.brief_id !== id) return NextResponse.json({ error: '找不到這個試音' }, { status: 404 });

  const { data: talent } = q.talent_id
    ? await r.db.from('talents').select('name, email').eq('id', q.talent_id).maybeSingle()
    : { data: null };

  // Anti self-dealing: a talent can't be awarded their own brief (same email both
  // sides) — that would let one account run the whole client↔talent loop on itself.
  if (talent?.email && String(talent.email).toLowerCase() === String(r.brief.client_email || '').toLowerCase()) {
    return NextResponse.json({ error: '無法選定:此配音員與客戶為同一帳號。' }, { status: 400 });
  }

  // Create the production order (pending_payment) from the awarded quote.
  const order = await createOrderFromAward(r.db, r.brief, q, {
    talentName: talent?.name as string | undefined,
    orderEmail: String(r.brief.client_email).toLowerCase(),
    scriptText: finalScript,
    scriptFileUrl: finalScriptUrl || undefined,
    deliveryDate,
  });
  if (!order.ok) return NextResponse.json({ error: order.error }, { status: order.status });

  // Award the quote + mark the brief closed (moved into production).
  await r.db.from('marketplace_quotes').update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', quoteId);
  await r.db.from('marketplace_briefs').update({ status: 'closed', awarded_quote_id: quoteId, updated_at: new Date().toISOString() }).eq('id', id);

  const title = (r.brief.title as string) || (r.brief.content_type as string) || '配音案件';
  // Notify the won talent (best-effort).
  if (talent?.email) {
    const tm = castingAwardedTalentEmail({ talentName: talent.name as string, title, url: `${SITE}/talent/opportunities`, locale: 'zh-TW' });
    sendEmail({ category: 'PRODUCTION', to: talent.email as string, subject: tm.subject, html: tm.html }).catch(() => {});
  }
  // Confirm to the client (order created · awaiting payment).
  const cm = castingOrderClientEmail({
    clientName: r.brief.client_name as string | undefined, title, orderNumber: order.order_number,
    amount: Number(q.gross_amount) || 0, currency: order.currency, deliveryDate,
    url: `${SITE}/dashboard/orders/${order.id}`, locale: (r.brief.locale as string) || undefined,
  });
  sendEmail({ category: 'PRODUCTION', to: String(r.brief.client_email), subject: cm.subject, html: cm.html }).catch(() => {});
  // Tell produce@ to collect payment + start production.
  const im = castingOrderInternalEmail({
    orderNumber: order.order_number, briefNumber: r.brief.brief_number as string | undefined,
    clientEmail: String(r.brief.client_email), talentName: talent?.name as string | undefined,
    amount: Number(q.gross_amount) || 0, currency: order.currency, deliveryDate, scriptPreview: finalScript,
  });
  sendEmail({ category: 'PRODUCTION', to: 'produce@onyxstudios.ai', subject: im.subject, html: im.html }).catch(() => {});

  return NextResponse.json({ ok: true, order_number: order.order_number, order_id: order.id });
}
