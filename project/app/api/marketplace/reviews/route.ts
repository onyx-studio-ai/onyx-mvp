import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  Two-way reviews on a COMPLETED casting order.
  POST { order_id, rating, comment } — the caller (resolved from their token) is
    detected as the client or the talent of that order; one review per side.
  GET  ?order_id=  → { client, talent } (so each UI knows what's been left).
  GET  ?talent_id= → public { avg, count, items } from client-authored reviews.
*/

async function resolve(request: NextRequest) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const db = getSupabaseServiceClient();
  const { data, error } = await db.auth.getUser(token);
  const email = (data?.user?.email || '').toLowerCase();
  if (error || !email) return null;
  const { data: talent } = await db.from('talents').select('id').eq('email', email).maybeSingle();
  return { db, email, userId: data.user.id, talentId: (talent as { id: string } | null)?.id || null };
}

export async function GET(request: NextRequest) {
  const db = getSupabaseServiceClient();
  const { searchParams } = new URL(request.url);
  const talentId = searchParams.get('talent_id');
  const orderId = searchParams.get('order_id');

  if (talentId) {
    const { data } = await db.from('marketplace_reviews')
      .select('rating, comment, created_at')
      .eq('talent_id', talentId).eq('reviewer_type', 'client')
      .order('created_at', { ascending: false }).limit(20);
    const items = data || [];
    const count = items.length;
    const avg = count ? Math.round((items.reduce((s, r) => s + (r.rating as number), 0) / count) * 10) / 10 : 0;
    return NextResponse.json({ avg, count, items });
  }

  if (orderId) {
    const { data } = await db.from('marketplace_reviews').select('reviewer_type, rating, comment').eq('order_id', orderId);
    const by = (t: string) => (data || []).find((r) => r.reviewer_type === t) || null;
    return NextResponse.json({ client: by('client'), talent: by('talent') });
  }

  return NextResponse.json({ error: 'talent_id or order_id required' }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const c = await resolve(request);
  if (!c) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body: { order_id?: string; rating?: number; comment?: string; reviewer_type?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const orderId = String(body.order_id || '');
  const wanted = body.reviewer_type === 'client' || body.reviewer_type === 'talent' ? body.reviewer_type : null;
  const rating = Math.trunc(Number(body.rating));
  const comment = String(body.comment || '').slice(0, 1000).trim() || null;
  if (!orderId) return NextResponse.json({ error: 'order_id is required' }, { status: 400 });
  if (!(rating >= 1 && rating <= 5)) return NextResponse.json({ error: '請給 1–5 星' }, { status: 400 });

  const { data: order } = await c.db.from('voice_orders')
    .select('id, email, talent_id, brief_id, status').eq('id', orderId).maybeSingle();
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.status !== 'completed') return NextResponse.json({ error: '結案後才能評價。' }, { status: 400 });

  // Who is reviewing — the talent of this order, or its client? The UI says which
  // side it's acting as (wanted); we just verify the caller qualifies for it. This
  // disambiguates when ONE account is both client and talent (same-email testing).
  const isTalent = !!(c.talentId && c.talentId === order.talent_id);
  const isClient = String(order.email || '').toLowerCase() === c.email;
  let reviewerType: 'client' | 'talent' | null = null;
  if (wanted) {
    if ((wanted === 'talent' && isTalent) || (wanted === 'client' && isClient)) reviewerType = wanted;
  } else {
    reviewerType = isClient ? 'client' : isTalent ? 'talent' : null;
  }
  if (!reviewerType) return NextResponse.json({ error: 'Not your order' }, { status: 403 });

  const { error } = await c.db.from('marketplace_reviews')
    .upsert({ order_id: orderId, brief_id: order.brief_id, talent_id: order.talent_id, reviewer_type: reviewerType, rating, comment },
      { onConflict: 'order_id,reviewer_type' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, reviewer_type: reviewerType });
}
