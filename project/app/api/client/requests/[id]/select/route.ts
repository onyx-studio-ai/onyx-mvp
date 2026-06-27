import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/mail';

/*
  POST /api/client/requests/[id]/select { quote_id } — the CLIENT picks an audition.
  This is the client-driven award (client casting cases): marks the chosen quote
  accepted + the brief awarded. Onyx then collects payment (manual / Paddle) and
  turns it into a production order. Talent payout is handled offline by Onyx.

  Owner-gated; only while the case is still auditioning (status='open').
*/
async function owner(request: NextRequest, id: string) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { error: 'Not authenticated', status: 401 as const };
  const db = getSupabaseServiceClient();
  const { data: userData, error } = await db.auth.getUser(token);
  const email = userData?.user?.email;
  if (error || !email) return { error: 'Invalid session', status: 401 as const };
  const { data: brief } = await db.from('marketplace_briefs').select('id, brief_number, status, client_email').eq('id', id).maybeSingle();
  if (!brief) return { error: 'Not found', status: 404 as const };
  if (String(brief.client_email || '').toLowerCase() !== email.toLowerCase()) return { error: 'Not your request', status: 403 as const };
  return { db, brief };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await owner(request, id);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.brief.status !== 'open') return NextResponse.json({ error: '此案目前無法選定(可能尚未開放徵選或已選定)。' }, { status: 400 });

  let b: { quote_id?: string };
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const quoteId = String(b.quote_id || '').trim();
  if (!quoteId) return NextResponse.json({ error: 'quote_id is required' }, { status: 400 });

  // The quote must belong to this brief.
  const { data: q } = await r.db.from('marketplace_quotes').select('id, brief_id, talent_id').eq('id', quoteId).maybeSingle();
  if (!q || q.brief_id !== id) return NextResponse.json({ error: '找不到這個試音' }, { status: 404 });

  await r.db.from('marketplace_quotes').update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', quoteId);
  const { error } = await r.db.from('marketplace_briefs').update({ status: 'awarded', awarded_quote_id: quoteId, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Tell Onyx to collect payment + spin up the production order (best-effort).
  sendEmail({
    category: 'PRODUCTION', to: 'produce@onyxstudios.ai',
    subject: `客戶已選定配音員 · ${r.brief.brief_number || id}`,
    html: `<p>客戶在請求 <b>${r.brief.brief_number || id}</b> 已選定一位配音員(報價 ID ${quoteId})。請收款後建立製作單。</p>`,
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}
