import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient, supabaseErrorResponse } from '@/lib/supabase-server';

/*
  Talent's OWN earnings/payouts. Authenticated by the talent's Supabase session
  (Bearer access token) and scoped to their own talents row via auth_user_id — a
  talent can only ever see their own money. Real data from talent_earnings; the
  talent never sees the order's real total or internal cost, only their share.
*/

export async function GET(request: NextRequest) {
  try {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const db = getSupabaseServiceClient();
    const { data: userData, error: userErr } = await db.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });

    let { data: talent } = await db.from('talents').select('id').eq('auth_user_id', user.id).maybeSingle();
    if (!talent && user.email) {
      // ilike:歷史 email 大小寫混雜,eq 會 miss(比照 casting/join 2026-07-22)
      const { data: byEmailRows } = await db.from('talents').select('id').ilike('email', user.email).limit(1);
      if (byEmailRows?.[0]) talent = byEmailRows[0];
    }
    if (!talent) return NextResponse.json({ error: 'No talent profile linked' }, { status: 404 });

    // Only the columns the talent should see — their cut, the type, status, date.
    const { data: rows, error } = await db
      .from('talent_earnings')
      .select('id, order_id, order_type, commission_amount, status, created_at')
      .eq('talent_id', talent.id)
      .order('created_at', { ascending: false });
    if (error) {
      // Table may not exist on a fresh DB — degrade gracefully to an empty list.
      return NextResponse.json({ earnings: [], totals: { paid: 0, pending: 0, total: 0 } });
    }

    // 幣別跟著「來源訂單」走(talent_earnings 沒存幣別;之前前端寫死 US$,台幣案
    // 全被顯示成美金 —— 2026-07-16 女王百貨配音員回報)。查不到訂單就當 TWD
    //(平台配音酬勞以台幣為主)。
    const curById = new Map<string, string>();
    const byType: Record<string, string[]> = {};
    for (const r of rows || []) if (r.order_id) (byType[r.order_type || 'voice'] ||= []).push(String(r.order_id));
    const TABLE: Record<string, string> = { voice: 'voice_orders', music: 'music_orders', strings: 'orchestra_orders' };
    for (const [ot, ids] of Object.entries(byType)) {
      const table = TABLE[ot] || 'voice_orders';
      const { data: os } = await db.from(table).select('id, currency').in('id', ids);
      for (const o of os || []) curById.set(String(o.id), String(o.currency || 'TWD').toUpperCase());
    }
    const earnings = (rows || []).map((r) => ({ ...r, currency: curById.get(String(r.order_id)) || 'TWD' }));

    const sum = (pred: (e: { status?: string | null; currency: string }) => boolean) =>
      Math.round(earnings.filter(pred).reduce((a, e) => a + (Number(e.commission_amount) || 0), 0) * 100) / 100;
    const totals = {
      paid: sum((e) => e.status === 'paid'),
      pending: sum((e) => e.status !== 'paid'),
      total: Math.round(earnings.reduce((a, e) => a + (Number(e.commission_amount) || 0), 0) * 100) / 100,
    };
    // 各幣別分開總計(不同幣別的金額不能加在一起)
    const totalsByCurrency: Record<string, { paid: number; pending: number; total: number }> = {};
    for (const cur of new Set(earnings.map((e) => e.currency))) {
      totalsByCurrency[cur] = {
        paid: sum((e) => e.status === 'paid' && e.currency === cur),
        pending: sum((e) => e.status !== 'paid' && e.currency === cur),
        total: sum((e) => e.currency === cur),
      };
    }

    return NextResponse.json({ earnings, totals, totalsByCurrency });
  } catch (err) {
    return supabaseErrorResponse(err, 'api/talent/earnings:GET');
  }
}
