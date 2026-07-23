import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { createOrderFromAward } from '@/lib/casting-to-order';
import { notifyBriefClosed } from '@/lib/brief-close';
import { isPlatformCase } from '@/lib/casting';

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
    .select('id, title, content_type, language, brief, client_email, status, awarded_quote_id, roles')
    .eq('id', briefId).maybeSingle();
  if (!brief) return NextResponse.json({ error: '找不到案件' }, { status: 404 });
  // 'awarded' = at least one winner accepted. Multi-role cases carry NO single
  // awarded_quote_id (each role is its own accepted quote), so don't require it.
  if (brief.status !== 'awarded') return NextResponse.json({ error: '此案尚未採用配音員,無法建單' }, { status: 400 });
  // Platform-posted cases (casting@) have no client on file — require an override
  // email from the admin so the order has a billing/delivery contact.
  // 平台案判定統一走 isPlatformCase(Wing 2026-07-23 拍板:空白 client_email = 客戶案;
  // 生產無空白單,零實際影響)。客戶案沿用 brief 上的 email。
  const isPlatform = isPlatformCase(brief.client_email);
  const orderEmail = isPlatform ? clientEmailOverride : String(brief.client_email).toLowerCase();
  if (!orderEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(orderEmail)) {
    return NextResponse.json({ error: '平台發案請提供客戶 email(用於帳務與交付)。' }, { status: 400 });
  }

  // Build one production order per ACCEPTED quote — a single winner for a single-
  // voice case, or one per role for a multi-role case. createOrderFromAward dedups
  // on (brief_id, role_name), so re-running is idempotent and won't double-book a role.
  const { data: accepted } = await db.from('marketplace_quotes')
    .select('id, gross_amount, net_amount, talent_id, currency, included_revisions, role_name')
    .eq('brief_id', briefId).eq('status', 'accepted');
  if (!accepted || !accepted.length) return NextResponse.json({ error: '找不到中選報價' }, { status: 400 });

  const created: { order_number?: string; id?: string }[] = [];
  let realErr: { error: string; status: number } | null = null;
  for (const quote of accepted) {
    const { data: talent } = quote.talent_id
      ? await db.from('talents').select('name').eq('id', quote.talent_id).maybeSingle()
      : { data: null };
    const r = await createOrderFromAward(db, brief, quote, { talentName: talent?.name as string | undefined, orderEmail });
    if (r.ok) created.push({ order_number: r.order_number, id: r.id });
    // 409 = this role already has an order (built in an earlier batch) → skip, not an error.
    else if (r.status !== 409 && !realErr) realErr = { error: r.error, status: r.status };
  }
  if (!created.length) {
    return NextResponse.json({ error: realErr?.error || '沒有新的角色需要建單(已選定的角色都建過製作單了)。' }, { status: realErr?.status || 400 });
  }

  // Close the case only when EVERY defined role has an accepted quote (multi-role),
  // or it's a single-voice case — so partial casting keeps the case open to pick the
  // rest (matches the client self-select path). Build can be re-run per batch.
  const briefRoles = (Array.isArray((brief as { roles?: { name?: string }[] }).roles) ? (brief as { roles?: { name?: string }[] }).roles! : [])
    .map((ro) => ro?.name).filter((n): n is string => !!n);
  const awardedRoles = new Set((accepted || []).map((qq) => qq.role_name).filter(Boolean));
  let allCast = briefRoles.length === 0 || briefRoles.every((rn) => awardedRoles.has(rn));
  if (allCast) {
    // 關案 update 若靜默失敗,回應卻回 closed:true → 後台以為關了其實沒關(2026-07-23 審查)
    // → 接 error,失敗時回 closed:false + log,讓後台看得出來要再關一次。
    const { error: closeErr } = await db.from('marketplace_briefs').update({ status: 'closed', close_reason: 'decided', updated_at: new Date().toISOString() }).eq('id', briefId);
    if (closeErr) {
      console.error('[casting/to-order] brief close failed (orders created):', closeErr.message);
      allCast = false;
    } else {
      // 一鍵通知未中選者「客戶已定案」(中選者另收採用通知,排除)—— Wing 2026-07-18
      await notifyBriefClosed(db, briefId, { excludeTalentIds: (accepted || []).map((qq) => qq.talent_id as string).filter(Boolean) });
    }
  }

  return NextResponse.json({ ok: true, order_number: created[0].order_number, id: created[0].id, count: created.length, closed: allCast });
}
