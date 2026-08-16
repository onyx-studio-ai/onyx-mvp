import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  GET /api/admin/revenue-report?month=YYYY-MM — 月營收一本帳(GMV/配音員成本/毛利)。
  範圍:voice_orders + music_orders + orchestra_orders,含線下收款(price 有填就算)。
  三層口徑(業界標準):GMV=客戶價合計;成本=配音員酬勞;毛利=GMV-成本。各幣別分開,不換匯。
  同時回報「未記價」訂單清單 —— price=0/null 的單看不出真實營收,列出來催補登。
*/

type Row = {
  order_number: string | number | null; project: string; price: number; talent_price: number;
  currency: string; payment_method: string; status: string | null; created_at: string; type: string;
};

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { searchParams } = new URL(request.url);
  const month = String(searchParams.get('month') || '').match(/^\d{4}-\d{2}$/)?.[0];
  if (!month) return NextResponse.json({ error: 'month=YYYY-MM required' }, { status: 400 });
  const from = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const to = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`;

  const db = getSupabaseServiceClient();
  const rows: Row[] = [];
  const { data: vo } = await db.from('voice_orders')
    .select('order_number, project_name, voice_selection, price, talent_price, currency, payment_method, status, created_at')
    .gte('created_at', from).lt('created_at', to).neq('status', 'draft');
  for (const o of vo || []) rows.push({
    order_number: o.order_number, project: String(o.project_name || o.voice_selection || ''),
    price: Number(o.price) || 0, talent_price: Number(o.talent_price) || 0,
    currency: String(o.currency || 'TWD'), payment_method: String(o.payment_method || '未填'),
    status: o.status, created_at: o.created_at, type: 'voice',
  });
  // music/orchestra 少量且欄位不一,select * 防欄位名差異造成整段靜默失敗
  for (const [table, type] of [['music_orders', 'music'], ['orchestra_orders', 'strings']] as const) {
    let q = db.from(table).select('*').gte('created_at', from).lt('created_at', to);
    if (table === 'music_orders') q = q.neq('status', 'draft');
    const { data } = await q;
    for (const o of (data || []) as Record<string, unknown>[]) rows.push({
      order_number: (o.order_number as string) ?? null,
      project: String(o.project_name || o.vibe || ''),
      price: Number(o.price) || 0, talent_price: Number(o.talent_price) || 0,
      currency: String(o.currency || 'TWD'), payment_method: String(o.payment_method || '未填'),
      status: (o.status as string) ?? null, created_at: String(o.created_at || ''), type,
    });
  }

  const byCurrency: Record<string, { gmv: number; talentCost: number; gross: number; orders: number }> = {};
  const byChannel: Record<string, number> = {};
  const unpriced: Row[] = [];
  for (const r of rows) {
    const c = (byCurrency[r.currency] ||= { gmv: 0, talentCost: 0, gross: 0, orders: 0 });
    c.gmv += r.price; c.talentCost += r.talent_price; c.gross = c.gmv - c.talentCost; c.orders += 1;
    byChannel[r.payment_method] = (byChannel[r.payment_method] || 0) + 1;
    if (!r.price) unpriced.push(r);
  }
  return NextResponse.json({ month, orders: rows.length, byCurrency, byChannel, unpriced, rows });
}
