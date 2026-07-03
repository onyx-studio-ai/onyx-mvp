import { NextRequest, NextResponse } from 'next/server';
import { resolveTalentFromRequest } from '@/lib/talent-auth';

/*
  配音員自己的請款單。
   GET   → 列出自己所有請款單
   POST  → 發起一筆請款 { amount, currency?, note?, invoice_type? } → 生成發票號、建 pending 單
   PATCH → 附上發票 + 同意 { id, invoice_url, consent } → status 'invoice_uploaded'

  必須先填好收款資料(talent_payout_details.completed)才能請款。
*/

const S = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function GET(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const { data } = await r.db.from('payout_requests')
    .select('id, invoice_number, amount, currency, note, invoice_type, invoice_url, consent_at, status, admin_note, paid_at, created_at')
    .eq('talent_id', (r.talent as { id: string }).id)
    .order('created_at', { ascending: false });
  return NextResponse.json({ requests: data || [] });
}

export async function POST(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const talentId = (r.talent as { id: string }).id;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const amount = Math.max(0, Number(body.amount) || 0);
  if (!amount) return NextResponse.json({ error: '請填寫請款金額。' }, { status: 400 });
  const currency = (S(body.currency, 8) || 'USD').toUpperCase();
  const note = S(body.note, 500);
  const invoiceType = body.invoice_type === 'own' ? 'own' : 'generated';

  // 必須先完成收款資料才能請款。
  const { data: pd } = await r.db.from('talent_payout_details').select('completed').eq('talent_id', talentId).maybeSingle();
  if (!pd?.completed) return NextResponse.json({ error: 'payout_details_required' }, { status: 400 });

  // 🔒 堵漏洞:沒有可請款款項就不能請款。可請款餘額 = 未付(pending)earnings 加總(USD)。
  const { data: earns } = await r.db.from('talent_earnings').select('commission_amount').eq('talent_id', talentId).eq('status', 'pending');
  const balance = (earns || []).reduce((sum, x) => sum + (Number(x.commission_amount) || 0), 0);
  if (balance <= 0) return NextResponse.json({ error: 'no_balance' }, { status: 400 });
  // 餘額以 USD 計;請款幣別為 USD 時才做上限檢查(跨幣別上限之後精算)。
  if (currency === 'USD' && amount > balance + 0.01) return NextResponse.json({ error: 'exceeds_balance', balance }, { status: 400 });

  // 發票號:ONX-INV-yyMMdd-當天序號。
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
  const { count } = await r.db.from('payout_requests').select('id', { count: 'exact', head: true }).gte('created_at', dayStart);
  const invoiceNumber = `ONX-INV-${ymd}-${String((count || 0) + 1).padStart(4, '0')}`;

  const { data, error } = await r.db.from('payout_requests').insert({
    talent_id: talentId, invoice_number: invoiceNumber, amount, currency, note,
    invoice_type: invoiceType, status: 'pending',
  }).select('id, invoice_number, amount, currency, invoice_type, status, created_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, request: data });
}

export async function PATCH(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const talentId = (r.talent as { id: string }).id;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const id = S(body.id, 64);
  const url = S(body.invoice_url, 1000);
  if (!id || !url) return NextResponse.json({ error: 'id 與 invoice_url 必填' }, { status: 400 });
  if (!/^https?:\/\//i.test(url)) return NextResponse.json({ error: 'invalid invoice_url' }, { status: 400 });
  if (body.consent !== true) return NextResponse.json({ error: '請先勾選同意以此開立發票。' }, { status: 400 });

  // 只能改自己的、且尚未撥款的請款單。
  const { data: pr } = await r.db.from('payout_requests').select('id, status').eq('id', id).eq('talent_id', talentId).maybeSingle();
  if (!pr) return NextResponse.json({ error: 'not your request' }, { status: 403 });
  if (pr.status === 'paid') return NextResponse.json({ error: '已撥款,無法修改。' }, { status: 400 });

  const { error } = await r.db.from('payout_requests').update({
    invoice_url: url, consent_at: new Date().toISOString(), status: 'invoice_uploaded', updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
