import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { normCaseLang } from '@/lib/languages';

/*
  One of the signed-in client's own requests.
    GET   — load the full brief (must belong to the caller's email).
    PATCH — edit it, ONLY while status='reviewing' (before Onyx confirms). Once it's
            open/awarded the client can no longer change it (contact Onyx).
*/

async function ownerBrief(request: NextRequest, id: string) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { error: 'Not authenticated', status: 401 as const };
  const db = getSupabaseServiceClient();
  const { data: userData, error } = await db.auth.getUser(token);
  const email = userData?.user?.email;
  if (error || !email) return { error: 'Invalid session', status: 401 as const };
  const { data: brief } = await db.from('marketplace_briefs').select('*').eq('id', id).maybeSingle();
  if (!brief) return { error: 'Not found', status: 404 as const };
  if (String(brief.client_email || '').toLowerCase() !== email.toLowerCase()) return { error: 'Not your request', status: 403 as const };
  delete (brief as Record<string, unknown>).internal_client_note;   // 內部備註不給客戶看
  return { db, brief, email };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await ownerBrief(request, id);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  // The auditions the client reviews + picks from. Talent identity is NOT exposed
  // (anonymous labels — Onyx mediates); client sees the demo, the price THEY pay,
  // the self-intro and which one they've picked.
  const { data: q } = await r.db.from('marketplace_quotes')
    .select('id, role_name, sample_url, gross_amount, currency, intro, message, status, created_at, reaudition_requested_at, more_demos_requested_at, extra_samples')
    .eq('brief_id', id)
    .in('status', ['submitted', 'shortlisted', 'accepted'])
    .order('created_at', { ascending: true });
  const auditions = (q || []).map((x, i) => ({
    id: x.id as string,
    label: `${String.fromCharCode(65 + (i % 26))}`,
    role_name: (x.role_name as string) || null,
    sample_url: (x.sample_url as string) || null,
    currency: (x.currency as string) || 'USD',
    client_pays: x.gross_amount as number,
    intro: (x.intro as string) || (x.message as string) || null,
    status: x.status as string,
    reaudition_requested: !!x.reaudition_requested_at,
    more_demos_requested: !!x.more_demos_requested_at,
    extra_samples: (Array.isArray(x.extra_samples) ? x.extra_samples : []) as { url: string; label?: string | null }[],
  }));
  // Sub-orders for this case (a multi-role brief has several — one per awarded
  // role). Surface them all + a project summary for the combined "pay-all".
  const { data: orders } = await r.db.from('voice_orders')
    .select('id, order_number, status, payment_status, price, currency, role_name, language, deadline')
    .eq('brief_id', id).order('created_at', { ascending: true });
  const list = orders || [];
  const unpaid = list.filter((o) => o.payment_status !== 'paid' && o.payment_status !== 'completed');
  const project = list.length ? {
    count: list.length,
    paidCount: list.length - unpaid.length,
    unpaidTotal: unpaid.reduce((s, o) => s + (Number(o.price) || 0), 0),
    currency: (list[0].currency as string) || 'USD',
  } : null;
  return NextResponse.json({ brief: r.brief, auditions, order: list[0] || null, orders: list, project });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await ownerBrief(request, id);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.brief.status !== 'reviewing') return NextResponse.json({ error: '此需求已進入處理,如需修改請聯絡 Onyx。' }, { status: 400 });

  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const s = (v: unknown, n = 200) => (v == null ? undefined : String(v).slice(0, n));
  // Only the client-editable fields; never status/kind/client_email/etc.
  const patch: Record<string, unknown> = {
    title: s(b.title, 200) ?? null,
    brief: s(b.brief, 8000) ?? r.brief.brief,
    // 語言寫入口統一正規化(旖樂案拍板延伸;admin PATCH 已套,客戶端編輯這口補上)
    language: (() => { const v = s(b.language, 80); return v ? normCaseLang(v) : (v ?? null); })(),
    budget: s(b.budget, 80) ?? null,
    budget_type: s(b.budget_type, 40) ?? null,
    audition_deadline: s(b.audition_deadline, 60) ?? null,
    deadline: s(b.deadline, 60) ?? null,
  };
  if (!String(patch.brief || '').trim()) return NextResponse.json({ error: '需求說明不能空白' }, { status: 400 });

  const { data, error } = await r.db.from('marketplace_briefs').update(patch).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  delete (data as Record<string, unknown>).internal_client_note;   // 內部備註不給客戶看
  return NextResponse.json({ brief: data });
}
