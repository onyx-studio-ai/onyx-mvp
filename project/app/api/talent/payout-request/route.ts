import { NextRequest, NextResponse } from 'next/server';
import { resolveTalentFromRequest } from '@/lib/talent-auth';
import { EXCHANGE_RATES } from '@/lib/currency';
import { renderInvoiceHtml } from '@/lib/invoice';
import { sellerFromPayoutDetails } from '@/lib/payout-seller';
import { signatureDataUri } from '@/lib/talent-signature';

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

  // 🔒 堵漏洞:沒有可請款款項就不能請款。可請款餘額 = 未付且未鏈結請款單的 earnings 加總
  //(payout_id 有值 = 已在某張請款單裡,不能重複請;status 只有 pending/paid 兩態)。
  const { data: earns } = await r.db.from('talent_earnings').select('commission_amount').eq('talent_id', talentId).eq('status', 'pending').is('payout_id', null);
  const balance = (earns || []).reduce((sum, x) => sum + (Number(x.commission_amount) || 0), 0);
  if (balance <= 0) return NextResponse.json({ error: 'no_balance' }, { status: 400 });
  // 餘額以 USD 計;請款金額一律換算成 USD 後比對上限(台幣用匯率換算,不再只擋 USD、TWD 也擋)。
  const rate = EXCHANGE_RATES[currency] || 1;   // USD=1、TWD≈30.1
  if (amount / rate > balance + 0.01) return NextResponse.json({ error: 'exceeds_balance', balance }, { status: 400 });

  // 發票號 = ONX-{配音員短碼}-{yyMMdd}-{該員當天序號}。
  //   短碼 = 該配音員 id 前 6 碼(每人固定、可回查本人),讓每個號碼都能辨識到
  //   「哪位配音員 + 哪天開的 + 當天第幾筆」,不再是全平台流水號。
  const d = new Date();
  const short = talentId.replace(/-/g, '').slice(0, 6).toUpperCase();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
  const { count } = await r.db.from('payout_requests').select('id', { count: 'exact', head: true }).eq('talent_id', talentId).gte('created_at', dayStart);
  const invoiceNumber = `ONX-${short}-${ymd}-${String((count || 0) + 1).padStart(3, '0')}`;

  const { data, error } = await r.db.from('payout_requests').insert({
    talent_id: talentId, invoice_number: invoiceNumber, amount, currency, note,
    invoice_type: invoiceType, status: 'pending',
  }).select('id, invoice_number, amount, currency, invoice_type, status, created_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // 🔒 把這次請款涵蓋的 earnings 鏈到請款單(payout_id = 已請款記號;status 受
  // check 約束只有 pending/paid,撥款時才轉 paid)。不鏈結的話 earnings 永遠停在
  // 可請款狀態 → 撥款後餘額照顯示、可重複請款,名單/報表全誤報(2026-08-09 布魯麵)。
  await r.db.from('talent_earnings')
    .update({ payout_id: data.id, updated_at: new Date().toISOString() })
    .eq('talent_id', talentId).eq('status', 'pending').is('payout_id', null);
  return NextResponse.json({ ok: true, request: data });
}

export async function PATCH(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id, name'); // name = 一鍵開立發票的賣方名 fallback
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const talentId = (r.talent as { id: string }).id;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const id = S(body.id, 64);

  // ── 一鍵開立:使用已存簽名檔,由系統生成已簽名發票直接送出(免列印/掃描/上傳)──
  if (body.use_signature === true) {
    if (!id) return NextResponse.json({ error: 'id 必填' }, { status: 400 });
    if (body.consent !== true) return NextResponse.json({ error: '請先勾選同意以此開立發票。' }, { status: 400 });
    const { data: pr } = await r.db.from('payout_requests')
      .select('id, status, invoice_number, amount, currency, note, created_at')
      .eq('id', id).eq('talent_id', talentId).maybeSingle();
    if (!pr) return NextResponse.json({ error: 'not your request' }, { status: 403 });
    if (pr.status === 'paid') return NextResponse.json({ error: '已撥款,無法修改。' }, { status: 400 });

    const sigUri = await signatureDataUri(r.db, talentId);
    if (!sigUri) return NextResponse.json({ error: '尚未上傳簽名檔,請先在上方「簽名檔」上傳一次。' }, { status: 400 });

    const { sellerName, sellerAddress, sellerTaxId } = await sellerFromPayoutDetails(r.db, talentId);
    const html = renderInvoiceHtml({
      invoiceNumber: pr.invoice_number as string,
      dateISO: (pr.created_at as string) || new Date().toISOString(),
      sellerName: sellerName || (r.talent as { name?: string }).name || '',
      sellerAddress, sellerTaxId,
      amount: Number(pr.amount) || 0,
      currency: (pr.currency as string) || 'USD',
      note: (pr.note as string) || '',
      signatureDataUri: sigUri,
    });
    const path = `payout/${talentId}/${Date.now()}_signed.html`;
    // 桶 mime 白名單是精確比對 —— 帶 charset 會被拒(text/html; charset=utf-8 ≠ text/html)
    const { error: upErr } = await r.db.storage.from('invoices').upload(path, html, { contentType: 'text/html' });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    const { error } = await r.db.from('payout_requests').update({
      invoice_url: path, consent_at: new Date().toISOString(), status: 'invoice_uploaded', updated_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const url = S(body.invoice_url, 1000);
  if (!id || !url) return NextResponse.json({ error: 'id 與 invoice_url 必填' }, { status: 400 });
  // 發票改存私有 invoices 桶的 storage path(payout/{本人id}/...),路徑即 ownership 檢查;
  // 舊資料是完整 https 公開網址,保留相容(2026-08-05 私有化)。
  const isOwnPath = url.startsWith(`payout/${talentId}/`) && !url.includes('..');
  if (!isOwnPath && !/^https?:\/\//i.test(url)) return NextResponse.json({ error: 'invalid invoice_url' }, { status: 400 });
  if (body.consent !== true) return NextResponse.json({ error: '請先勾選同意以此開立發票。' }, { status: 400 });

  // 只能改自己的、且尚未撥款的請款單。
  const { data: pr } = await r.db.from('payout_requests').select('id, status').eq('id', id).eq('talent_id', talentId).maybeSingle();
  if (!pr) return NextResponse.json({ error: 'not your request' }, { status: 403 });
  if (pr.status === 'paid') return NextResponse.json({ error: '已撥款,無法修改。' }, { status: 400 });

  const { error } = await r.db.from('payout_requests').update({
    invoice_url: url, consent_at: new Date().toISOString(), status: 'invoice_uploaded', updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // 通知走平台側欄徽章(payout_requests status in pending/invoice_uploaded),不寄自我 email。
  return NextResponse.json({ ok: true });
}
