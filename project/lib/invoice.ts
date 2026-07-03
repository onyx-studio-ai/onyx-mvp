/*
  請款發票生成(可列印 HTML)。配音員是賣方(收款人)、我們是買方(付款人)。
  系統依配音員填好的收款資料自動帶入,他確認後可列印/存 PDF、簽名、上傳。

  ⚠️ 我方(買方)公司登記地址 / 統編我沒有,先留空待 Wing 補 —— 絕不亂填。
*/

// 我方(買方)資訊 —— 凡音文化 = FINE ENTERTAINMENT CO., LTD.(2026-07-03 Wing 提供)
export const ONYX_ENTITY = {
  name: 'FINE ENTERTAINMENT CO., LTD.',
  address: '2 F., No. 79, Anping Rd., Zhonghe Dist., New Taipei City 235071, Taiwan (R.O.C.)',
  taxId: '24312593',
  email: 'billing@onyxstudios.ai',
};

const esc = (s: string) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const money = (n: number, cur: string) => `${cur} ${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface InvoiceData {
  invoiceNumber: string;
  dateISO: string;              // 開立日期
  sellerName: string;           // 配音員姓名 / 公司(法定)
  sellerAddress?: string;       // 配音員地址(台灣的有,海外選填)
  description?: string;         // 服務說明,預設 Voiceover services
  amount: number;               // 請款額 gross
  currency: string;
  note?: string;
}

// 回傳一張完整、可列印(A4)的 HTML 發票。是獨立頁面,故含 <html>。
export function renderInvoiceHtml(p: InvoiceData): string {
  const date = (p.dateISO || '').slice(0, 10);
  const desc = p.description || 'Voiceover / voice talent services 配音勞務';
  const buyerLines = [ONYX_ENTITY.address, ONYX_ENTITY.taxId ? `統編 ${ONYX_ENTITY.taxId}` : '', ONYX_ENTITY.email].filter(Boolean).map((l) => `<div>${esc(l)}</div>`).join('');
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${esc(p.invoiceNumber)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: -apple-system, 'PingFang TC', 'Microsoft JhengHei', system-ui, sans-serif; color: #1a1a1a; font-size: 14px; line-height: 1.6; max-width: 720px; margin: 24px auto; padding: 0 16px; }
  .hd { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #16a34a; padding-bottom:14px; margin-bottom:22px; }
  .title { font-size: 26px; font-weight: 700; letter-spacing: 1px; }
  .muted { color:#666; font-size:12px; }
  .cols { display:flex; gap:32px; margin-bottom:22px; }
  .cols > div { flex:1; }
  .lbl { font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#888; margin-bottom:4px; }
  table { width:100%; border-collapse:collapse; margin:18px 0; }
  th,td { text-align:left; padding:10px 8px; border-bottom:1px solid #eee; }
  th { font-size:11px; text-transform:uppercase; color:#888; }
  .amt { text-align:right; }
  .total { font-size:18px; font-weight:700; }
  .sign { margin-top:48px; display:flex; justify-content:space-between; gap:32px; }
  .sign > div { flex:1; }
  .sigline { border-bottom:1px solid #999; height:40px; margin-bottom:4px; }
  .print { margin:20px 0; text-align:center; }
  .print button { background:#16a34a; color:#fff; border:none; padding:10px 22px; border-radius:8px; font-size:14px; cursor:pointer; }
  @media print { .print { display:none; } body { margin:0; } }
</style></head><body>
  <div class="print"><button onclick="window.print()">列印 / 存成 PDF</button></div>
  <div class="hd">
    <div><div class="title">INVOICE 發票</div><div class="muted">No. ${esc(p.invoiceNumber)}</div></div>
    <div style="text-align:right"><div class="muted">開立日期 Date</div><div>${esc(date)}</div></div>
  </div>
  <div class="cols">
    <div><div class="lbl">賣方 / From(收款人)</div><div style="font-weight:600">${esc(p.sellerName)}</div>${p.sellerAddress ? `<div>${esc(p.sellerAddress)}</div>` : ''}</div>
    <div><div class="lbl">買方 / Bill to(付款人)</div><div style="font-weight:600">${esc(ONYX_ENTITY.name)}</div>${buyerLines}</div>
  </div>
  <table>
    <thead><tr><th>說明 Description</th><th class="amt">金額 Amount</th></tr></thead>
    <tbody>
      <tr><td>${esc(desc)}${p.note ? `<div class="muted">${esc(p.note)}</div>` : ''}</td><td class="amt">${money(p.amount, p.currency)}</td></tr>
    </tbody>
    <tfoot><tr><td class="total">合計 Total</td><td class="amt total">${money(p.amount, p.currency)}</td></tr></tfoot>
  </table>
  <div class="sign">
    <div><div class="sigline"></div><div class="muted">賣方簽名 Signature</div></div>
    <div><div class="sigline"></div><div class="muted">日期 Date</div></div>
  </div>
  <p class="muted" style="margin-top:32px">此發票由 Onyx Studios 平台依配音員提供之收款資料自動生成,經配音員確認簽署後生效。</p>
</body></html>`;
}
