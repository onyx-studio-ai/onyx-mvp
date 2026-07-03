import { NextRequest, NextResponse } from 'next/server';
import { resolveTalentFromRequest } from '@/lib/talent-auth';
import { decryptJson, payoutEncConfigured } from '@/lib/payout-crypto';
import { renderInvoiceHtml } from '@/lib/invoice';

/*
  GET /api/talent/invoice?id=<payout_request id> → 回傳該請款單的可列印 HTML 發票。
  賣方(配音員)姓名/地址取自加密的收款資料。前端用 Bearer token fetch 後,以 blob
  開新分頁列印/存 PDF(瀏覽器導航不帶 header,故不能直接開 URL)。
*/
export async function GET(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id, name');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const talentId = (r.talent as { id: string }).id;
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data: pr } = await r.db.from('payout_requests')
    .select('invoice_number, amount, currency, note, created_at')
    .eq('id', id).eq('talent_id', talentId).maybeSingle();
  if (!pr) return NextResponse.json({ error: 'not your request' }, { status: 403 });

  // 賣方(配音員)姓名 + 地址 ← 解密收款資料。
  let sellerName = '', sellerAddress = '';
  if (payoutEncConfigured()) {
    const { data: pd } = await r.db.from('talent_payout_details').select('enc_payload').eq('talent_id', talentId).maybeSingle();
    if (pd?.enc_payload) {
      try {
        const d = decryptJson<Record<string, string>>(pd.enc_payload as string);
        sellerName = d.account_holder || '';
        sellerAddress = d.tax_address || '';
      } catch { /* 解不開就留空 */ }
    }
  }

  const html = renderInvoiceHtml({
    invoiceNumber: pr.invoice_number as string,
    dateISO: (pr.created_at as string) || new Date().toISOString(),
    sellerName: sellerName || (r.talent as { name?: string }).name || '',
    sellerAddress,
    amount: Number(pr.amount) || 0,
    currency: (pr.currency as string) || 'USD',
    note: (pr.note as string) || '',
  });
  return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
