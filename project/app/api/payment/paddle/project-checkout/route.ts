import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHostedCheckout } from '@/lib/payments/paddle';

/*
  POST /api/payment/paddle/project-checkout { briefId, billingDetails?, successUrl?, cancelUrl? }

  Combined "pay-all" for a multi-role casting project: sums every UNPAID voice_order
  sub-order under the brief into ONE Paddle checkout. The webhook (custom_data
  kind:'project') then marks every sub-order paid at once. Single-order checkout
  still uses /api/payment/paddle/checkout.
*/
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function db() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

function landingUrl(request: NextRequest, successUrl?: string): string {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || request.headers.get('origin') || request.nextUrl.origin;
  let locale = 'en';
  if (typeof successUrl === 'string' && successUrl.startsWith('http')) {
    try {
      const seg = new URL(successUrl).pathname.split('/').filter(Boolean)[0];
      if (seg && ['en', 'zh-TW', 'zh-CN'].includes(seg)) locale = seg;
    } catch { /* keep default */ }
  }
  return `${origin.replace(/\/$/, '')}/${locale}/paddle-checkout`;
}

export async function POST(request: NextRequest) {
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Server payment configuration is incomplete' }, { status: 500 });
    const body = await request.json();
    const { briefId, billingDetails, licenseeDetails, successUrl, cancelUrl } = body ?? {};
    if (!briefId) return NextResponse.json({ error: 'Missing briefId' }, { status: 400 });

    const sb = db();
    // Every still-unpaid sub-order under this brief.
    const { data: orders } = await sb.from('voice_orders')
      .select('id, order_number, price, currency, payment_status, status, brief_id')
      .eq('brief_id', briefId);
    const unpaid = (orders || []).filter((o) => o.payment_status !== 'paid' && o.payment_status !== 'completed');
    if (!unpaid.length) return NextResponse.json({ error: '此專案沒有待付款的子單(可能已付清)。' }, { status: 409 });

    const total = unpaid.reduce((s, o) => s + (Number(o.price) || 0), 0);
    if (total <= 0) return NextResponse.json({ error: 'Project amount is invalid' }, { status: 409 });
    // Sub-orders share the brief's currency; guard against a mixed set just in case.
    const currencies = [...new Set(unpaid.map((o) => (o.currency || 'USD').toUpperCase()))];
    if (currencies.length > 1) return NextResponse.json({ error: '子單幣別不一致,無法合併結帳。' }, { status: 409 });
    const currency = currencies[0] || 'USD';

    const { data: brief } = await sb.from('marketplace_briefs').select('brief_number, title').eq('id', briefId).maybeSingle();
    const label = (brief?.brief_number as string) || 'PROJECT';

    const { checkoutUrl, transactionId } = await createHostedCheckout({
      orderId: briefId,
      orderNumber: `${label} (${unpaid.length} ${unpaid.length === 1 ? 'role' : 'roles'})`,
      orderType: 'voice',
      amount: total,
      currency,
      billingDetails,
      licenseeDetails,
      checkoutBaseUrl: landingUrl(request, successUrl),
      extraCustomData: { briefId, kind: 'project' },
    });

    const hostedUrl = new URL(checkoutUrl);
    if (typeof successUrl === 'string' && successUrl.startsWith('http')) hostedUrl.searchParams.set('success_url', successUrl);
    if (typeof cancelUrl === 'string' && cancelUrl.startsWith('http')) hostedUrl.searchParams.set('cancel_url', cancelUrl);

    return NextResponse.json({ checkoutUrl: hostedUrl.toString(), transactionId, briefId, total, currency, roles: unpaid.length });
  } catch (error) {
    console.error('[Paddle project-checkout] Error:', error);
    return NextResponse.json({ error: 'Failed to create project checkout', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
