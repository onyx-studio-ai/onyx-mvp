import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  Two-way, Fiverr-style reviews on a COMPLETED casting order.
  - Multi-dimension: overall `rating` + sub-ratings (communication / quality /
    delivery). Overall is the average of whichever sub-ratings are given.
  - Double-blind: a review is only REVEALED to the counterpart (and counted on the
    public profile) once BOTH sides have reviewed, or 14 days pass — so neither
    side can retaliate after seeing the other's score.

  POST { order_id, reviewer_type?, rating_communication, rating_quality,
         rating_delivery, comment } — caller verified as that order's client/talent.
  GET  ?order_id&as=  → { mine, theirs, theirsHidden } (double-blind applied).
  GET  ?talent_id=    → public { avg, count, dims, items } (revealed only).
*/

const REVEAL_DAYS = 14;
const REVEAL_MS = REVEAL_DAYS * 24 * 60 * 60 * 1000;

type Row = {
  order_id?: string; reviewer_type?: string; rating: number; comment: string | null; created_at: string;
  rating_communication?: number | null; rating_quality?: number | null; rating_delivery?: number | null;
};

const REVIEW_COLS = 'order_id, reviewer_type, rating, rating_communication, rating_quality, rating_delivery, comment, created_at';
const avgOf = (nums: number[]) => (nums.length ? Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10 : 0);

async function resolve(request: NextRequest) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const db = getSupabaseServiceClient();
  const { data, error } = await db.auth.getUser(token);
  const email = (data?.user?.email || '').toLowerCase();
  if (error || !email) return null;
  // 不閘 is_active(同 marketplace-auth 2026-07-17 修法:未上線配音員也是有效身分)。
  const { data: talent } = await db.from('talents').select('id').eq('email', email).maybeSingle();
  return { db, email, userId: data.user.id, talentId: (talent as { id: string } | null)?.id || null };
}

export async function GET(request: NextRequest) {
  const db = getSupabaseServiceClient();
  const { searchParams } = new URL(request.url);
  const talentId = searchParams.get('talent_id');
  const orderId = searchParams.get('order_id');
  const now = Date.now();

  if (talentId) {
    // Public: client→talent reviews that are REVEALED (both sides reviewed that
    // order, or 14 days elapsed). Hidden ones don't count toward the public score.
    const { data: cliRows } = await db.from('marketplace_reviews')
      .select(REVIEW_COLS).eq('talent_id', talentId).eq('reviewer_type', 'client')
      .order('created_at', { ascending: false }).limit(50);
    const rows = (cliRows || []) as Row[];
    const orderIds = rows.map((r) => r.order_id).filter(Boolean) as string[];
    let bothOrders = new Set<string>();
    if (orderIds.length) {
      const { data: tRows } = await db.from('marketplace_reviews').select('order_id').eq('reviewer_type', 'talent').in('order_id', orderIds);
      bothOrders = new Set((tRows || []).map((r) => r.order_id as string));
    }
    const revealed = rows.filter((r) => bothOrders.has(r.order_id as string) || (now - new Date(r.created_at).getTime()) > REVEAL_MS);
    const count = revealed.length;
    const dim = (k: keyof Row) => avgOf(revealed.map((r) => Number(r[k])).filter((n) => n >= 1));
    return NextResponse.json({
      avg: avgOf(revealed.map((r) => r.rating)),
      count,
      dims: { communication: dim('rating_communication'), quality: dim('rating_quality'), delivery: dim('rating_delivery') },
      items: revealed.slice(0, 20).map((r) => ({ rating: r.rating, comment: r.comment, created_at: r.created_at })),
    });
  }

  if (orderId) {
    const c = await resolve(request);
    if (!c) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { data: order } = await db.from('voice_orders').select('email, talent_id').eq('id', orderId).maybeSingle();
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    const isParty = (c.talentId && c.talentId === order.talent_id) || String(order.email || '').toLowerCase() === c.email;
    if (!isParty) return NextResponse.json({ error: 'Not your order' }, { status: 403 });

    // Caller's side: the page tells us (as=), else detect (client preferred).
    const asParam = searchParams.get('as');
    const myType = asParam === 'talent' || asParam === 'client' ? asParam
      : String(order.email || '').toLowerCase() === c.email ? 'client' : 'talent';
    const otherType = myType === 'client' ? 'talent' : 'client';

    const { data } = await db.from('marketplace_reviews').select(REVIEW_COLS).eq('order_id', orderId);
    const rows = (data || []) as Row[];
    const mine = rows.find((r) => r.reviewer_type === myType) || null;
    const theirRaw = rows.find((r) => r.reviewer_type === otherType) || null;
    const bothExist = !!mine && !!theirRaw;
    const theirRevealed = !!theirRaw && (bothExist || (now - new Date(theirRaw.created_at).getTime()) > REVEAL_MS);
    return NextResponse.json({
      mine,
      theirs: theirRevealed ? theirRaw : null,
      theirsHidden: !!theirRaw && !theirRevealed, // they reviewed, sealed until reveal
    });
  }

  return NextResponse.json({ error: 'talent_id or order_id required' }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const c = await resolve(request);
  if (!c) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body: { order_id?: string; reviewer_type?: string; comment?: string; rating?: number; rating_communication?: number; rating_quality?: number; rating_delivery?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const orderId = String(body.order_id || '');
  const wanted = body.reviewer_type === 'client' || body.reviewer_type === 'talent' ? body.reviewer_type : null;
  const comment = String(body.comment || '').slice(0, 1000).trim() || null;
  if (!orderId) return NextResponse.json({ error: 'order_id is required' }, { status: 400 });

  // Sub-ratings (1-5); overall = average of those provided (fallback to body.rating).
  const sub = (v: unknown) => { const n = Math.trunc(Number(v)); return n >= 1 && n <= 5 ? n : null; };
  const rc = sub(body.rating_communication), rq = sub(body.rating_quality), rd = sub(body.rating_delivery);
  const given = [rc, rq, rd].filter((n): n is number => n != null);
  const overall = given.length ? Math.round((given.reduce((s, n) => s + n, 0) / given.length)) : sub(body.rating);
  if (!overall) return NextResponse.json({ error: '請至少給一項 1–5 星評分。' }, { status: 400 });

  const { data: order } = await c.db.from('voice_orders').select('id, email, talent_id, brief_id, status').eq('id', orderId).maybeSingle();
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.status !== 'completed') return NextResponse.json({ error: '結案後才能評價。' }, { status: 400 });

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
    .upsert({
      order_id: orderId, brief_id: order.brief_id, talent_id: order.talent_id, reviewer_type: reviewerType,
      rating: overall, rating_communication: rc, rating_quality: rq, rating_delivery: rd, comment,
    }, { onConflict: 'order_id,reviewer_type' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, reviewer_type: reviewerType });
}
