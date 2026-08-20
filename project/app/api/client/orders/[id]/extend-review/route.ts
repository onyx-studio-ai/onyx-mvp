import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { AUTO_APPROVE_EXTEND_DAYS } from '@/lib/auto-approve';

/*
  POST /api/client/orders/[id]/extend-review
  客戶自行延長審核期 7 天(次數不限)。

  有這顆按鈕,自動完成才站得住腳 —— 只要客戶有在管,單子就永遠不會被自動結案;
  真正被自動完成的,一定是拿了檔案就完全沒動作的。

  安全:比照 review API,用 Bearer token 認證,且只允許訂單 email 的本人操作
  (瀏覽器直接寫 voice_orders 會被 RLS 擋掉,所以走 server 的 service role)。
*/
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  const authClient = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: userData } = await authClient.auth.getUser(token);
  const email = userData?.user?.email;
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getSupabaseServiceClient();
  const { data: order } = await db.from('voice_orders')
    .select('id, email, status, auto_approve_at, approve_extend_count')
    .eq('id', id).maybeSingle();
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (String(order.email || '').toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: 'Not your order' }, { status: 403 });
  }
  if (order.status !== 'delivered') {
    return NextResponse.json({ error: '此訂單目前不在審核階段。' }, { status: 400 });
  }
  if (!order.auto_approve_at) {
    return NextResponse.json({ error: '此訂單沒有自動完成期限,不需延長。' }, { status: 400 });
  }

  // 從「現在」和「原到期日」取較晚者往後加,避免早早按延期反而縮短總時間
  const base = Math.max(Date.now(), new Date(order.auto_approve_at).getTime());
  const next = new Date(base + AUTO_APPROVE_EXTEND_DAYS * 86400_000).toISOString();
  const { error } = await db.from('voice_orders').update({
    auto_approve_at: next,
    approve_extend_count: (Number(order.approve_extend_count) || 0) + 1,
    updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, auto_approve_at: next, extend_count: (Number(order.approve_extend_count) || 0) + 1 });
}
