import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { createOrderFromAward } from '@/lib/casting-to-order';

/*
  POST /api/admin/casting/to-order — turn an AWARDED casting brief into a production
  order. This is the handoff from the audition/marketplace side into the existing
  voice_orders pipeline (which already handles delivery upload, QC, client view in
  /dashboard). Pre-fills from the awarded quote (talent, price) + the brief.

  After creating the order the casting brief is closed (so it can't be converted
  twice and leaves the open marketplace).
*/
export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const briefId = String(b.briefId || '').trim();
  if (!briefId) return NextResponse.json({ error: 'missing briefId' }, { status: 400 });
  // Optional end-client email for platform-posted cases (which carry no client_email).
  const clientEmailOverride = String(b.clientEmail || '').trim().toLowerCase();

  const db = getSupabaseServiceClient();
  const { data: brief } = await db.from('marketplace_briefs')
    .select('id, title, content_type, language, brief, client_email, status, awarded_quote_id')
    .eq('id', briefId).maybeSingle();
  if (!brief) return NextResponse.json({ error: '找不到案件' }, { status: 404 });
  if (brief.status !== 'awarded' || !brief.awarded_quote_id) return NextResponse.json({ error: '此案尚未採用配音員,無法建單' }, { status: 400 });
  // Platform-posted cases (casting@) have no client on file — require an override
  // email from the admin so the order has a billing/delivery contact.
  const isPlatform = !brief.client_email || brief.client_email === 'casting@onyxstudios.ai';
  const orderEmail = isPlatform ? clientEmailOverride : String(brief.client_email).toLowerCase();
  if (!orderEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(orderEmail)) {
    return NextResponse.json({ error: '平台發案請提供客戶 email(用於帳務與交付)。' }, { status: 400 });
  }

  const { data: quote } = await db.from('marketplace_quotes')
    .select('id, gross_amount, net_amount, talent_id, currency, included_revisions, role_name')
    .eq('id', brief.awarded_quote_id).maybeSingle();
  if (!quote) return NextResponse.json({ error: '找不到中選報價' }, { status: 400 });
  const { data: talent } = quote.talent_id
    ? await db.from('talents').select('name').eq('id', quote.talent_id).maybeSingle()
    : { data: null };

  const r = await createOrderFromAward(db, brief, quote, {
    talentName: talent?.name as string | undefined,
    orderEmail,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  // Close the casting brief — it's moved to production now.
  await db.from('marketplace_briefs').update({ status: 'closed', updated_at: new Date().toISOString() }).eq('id', briefId);

  return NextResponse.json({ ok: true, order_number: r.order_number, id: r.id });
}
