import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getVoiceTierLabel, getMusicTierLabel } from '@/lib/config/pricing.config';
import { generateInvoicePdf } from '@/lib/invoice-pdf';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function buildHtml(params: {
  orderNum: string;
  paidDate: string;
  billingName: string;
  billingCompany: string;
  billingVat: string;
  billingEmail: string;
  billingAddress: string;
  billingCountry: string;
  displayName: string;
  itemType: string;
  itemDetails: string;
  price: string;
  transactionId: string;
}): string {
  const {
    orderNum, paidDate, billingName, billingCompany, billingVat,
    billingEmail, billingAddress, billingCountry, displayName,
    itemType, itemDetails, price, transactionId,
  } = params;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Invoice #${orderNum} — Onyx Studios</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    background: #fff;
    color: #111;
    font-size: 14px;
    line-height: 1.5;
  }
  .page { max-width: 720px; margin: 0 auto; padding: 48px 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  .brand { display: flex; flex-direction: column; gap: 4px; }
  .brand-name { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; color: #000; }
  .brand-sub { font-size: 12px; color: #888; }
  .invoice-meta { text-align: right; }
  .invoice-title { font-size: 28px; font-weight: 800; letter-spacing: -1px; color: #000; }
  .invoice-num { font-size: 13px; color: #555; margin-top: 4px; }
  .divider { border: none; border-top: 1px solid #e5e5e5; margin: 28px 0; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
  .section-label { font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #999; margin-bottom: 6px; }
  .section-value { font-size: 14px; color: #111; font-weight: 500; }
  .section-sub { font-size: 12px; color: #666; margin-top: 2px; }
  .status-paid {
    display: inline-flex; align-items: center; gap: 6px;
    background: #f0fdf4; border: 1px solid #bbf7d0;
    color: #15803d; font-size: 12px; font-weight: 600;
    padding: 4px 10px; border-radius: 20px;
  }
  .status-dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  thead tr { border-bottom: 2px solid #111; }
  thead th { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #555; padding: 8px 0; text-align: left; }
  thead th:last-child { text-align: right; }
  tbody tr { border-bottom: 1px solid #f0f0f0; }
  tbody td { padding: 14px 0; font-size: 13px; color: #222; vertical-align: top; }
  tbody td:last-child { text-align: right; font-weight: 600; }
  .item-name { font-weight: 600; color: #111; }
  .item-desc { font-size: 11px; color: #888; margin-top: 3px; }
  .totals { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; margin-top: 16px; }
  .total-row { display: flex; gap: 40px; font-size: 13px; color: #555; }
  .total-row span:last-child { min-width: 80px; text-align: right; }
  .total-final { display: flex; gap: 40px; font-size: 16px; font-weight: 700; color: #000; border-top: 2px solid #111; padding-top: 10px; margin-top: 4px; }
  .total-final span:last-child { min-width: 80px; text-align: right; }
  .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #eee; display: flex; justify-content: space-between; align-items: flex-end; }
  .footer-note { font-size: 11px; color: #aaa; max-width: 320px; line-height: 1.6; }
  .txn { font-size: 10px; color: #bbb; margin-top: 4px; font-family: monospace; }
  @media print {
    body { background: #fff; }
    .page { padding: 24px; }
    .no-print { display: none; }
  }
  .print-btn {
    display: inline-flex; align-items: center; gap: 8px;
    background: #000; color: #fff; border: none;
    padding: 10px 20px; border-radius: 6px; font-size: 13px;
    font-weight: 500; cursor: pointer; margin-bottom: 32px;
  }
</style>
</head>
<body>
<div class="page">
  <button class="print-btn no-print" onclick="window.print()">
    Print / Save as PDF
  </button>

  <div class="header">
    <div class="brand">
      <div class="brand-name">Onyx Studios</div>
      <div class="brand-sub">Professional Voice &amp; Music Production</div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-title">INVOICE</div>
      <div class="invoice-num">#${orderNum}</div>
    </div>
  </div>

  <hr class="divider" />

  <div class="two-col">
    <div>
      <div class="section-label">Billed To</div>
      ${billingName && billingName !== billingEmail ? `<div class="section-value">${billingName}</div>` : ''}
      ${billingCompany ? `<div class="section-sub" style="font-weight:600;">${billingCompany}</div>` : ''}
      ${billingVat ? `<div class="section-sub">VAT / Tax ID: ${billingVat}</div>` : ''}
      <div class="section-sub">${billingEmail}</div>
      ${billingAddress ? `<div class="section-sub">${billingAddress}</div>` : ''}
      ${billingCountry ? `<div class="section-sub">${billingCountry}</div>` : ''}
    </div>
    <div>
      <div class="section-label">Invoice Details</div>
      <div class="section-value">Date: ${paidDate}</div>
      <div class="section-sub">Order: #${orderNum}</div>
      <div class="section-sub" style="margin-top:8px">
        <span class="status-paid"><span class="status-dot"></span> Paid</span>
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Details</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <div class="item-name">${displayName}</div>
          <div class="item-desc">${itemType}</div>
        </td>
        <td style="color:#444;font-size:13px;">${itemDetails}</td>
        <td>US$${price}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row">
      <span>Subtotal</span>
      <span>US$${price}</span>
    </div>
    <div class="total-final">
      <span>Total</span>
      <span>US$${price}</span>
    </div>
  </div>

  <div class="footer">
    <div class="footer-note">
      Thank you for your order. For questions regarding this invoice, please contact us at billing@onyxstudios.ai
      <div class="txn">Transaction ID: ${transactionId}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;color:#aaa">Onyx Studios</div>
      <div style="font-size:10px;color:#ccc;margin-top:2px">www.onyxstudios.ai</div>
    </div>
  </div>
</div>
</body>
</html>`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const type = req.nextUrl.searchParams.get('type') || 'voice';

  if (type === 'music') {
    const { data: order, error } = await supabaseAdmin
      .from('music_orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const billing = order.billing_details as Record<string, string> | null;
    const orderNum = String(order.order_number || order.id).padStart(4, '0');
    const paidDate = order.paid_at
      ? new Date(order.paid_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const displayName = order.vibe ? `${order.vibe} Music` : 'Custom Music';
    const price = Number(order.price).toFixed(2);
    const tierLabel = getMusicTierLabel(order.tier || 'Custom');
    const usageLabel = order.usage_type || '';

    const billingEmail = billing?.email || order.email;
    const billingName = billing?.fullName || billing?.full_name || billing?.name || '';
    const billingCompany = billing?.companyName || billing?.company_name || billing?.company || '';
    const billingVat = billing?.vatNumber || billing?.vat_number || billing?.vat || billing?.tax_id || '';
    const billingCountry = billing?.country || '';
    const billingAddress = billing?.address || billing?.region || '';
    const transactionId = order.transaction_id || order.id;

    const pdfBuffer = await generateInvoicePdf({
      orderNum,
      paidDate,
      billingName,
      billingCompany,
      billingVat,
      billingEmail,
      billingAddress,
      billingCountry,
      displayName,
      itemType: `Music Production — ${tierLabel}`,
      itemDetails: [usageLabel, order.string_addon ? `+ String Arrangement` : ''].filter(Boolean).join(' · '),
      price,
      transactionId,
    });

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${orderNum}.pdf"`,
      },
    });
  }

  const { data: order, error } = await supabaseAdmin
    .from('voice_orders')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const billing = order.billing_details as Record<string, string> | null;
  const orderNum = String(order.order_number).padStart(4, '0');
  const paidDate = order.paid_at
    ? new Date(order.paid_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const displayName = order.project_name || `${order.tone_style} / ${order.voice_selection}`;
  const price = Number(order.price).toFixed(2);
  const tierLabel = getVoiceTierLabel(order.tier);
  const rightsLabel = order.broadcast_rights ? 'Broadcast License' : 'Standard License';

  const billingEmail = billing?.email || order.email;
  const billingName = billing?.fullName || billing?.full_name || billing?.name || '';
  const billingCompany = billing?.companyName || billing?.company_name || billing?.company || '';
  const billingVat = billing?.vatNumber || billing?.vat_number || billing?.vat || billing?.tax_id || '';
  const billingCountry = billing?.country || '';
  const billingAddress = billing?.address || billing?.region || '';
  const transactionId = order.transaction_id || order.id;

  const pdfBuffer = await generateInvoicePdf({
    orderNum,
    paidDate,
    billingName,
    billingCompany,
    billingVat,
    billingEmail,
    billingAddress,
    billingCountry,
    displayName,
    itemType: `Voice Production — ${tierLabel}`,
    itemDetails: `${order.language} · ${order.voice_selection} · ${rightsLabel} · ${order.duration} min`,
    price,
    transactionId,
  });

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${orderNum}.pdf"`,
    },
  });
}
