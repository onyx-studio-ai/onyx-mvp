import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHostedCheckout } from '@/lib/payments/paddle';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function createServiceClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function resolveOrder(orderId: string) {
  const db = createServiceClient();

  const { data: voiceOrder } = await db.from('voice_orders').select('*').eq('id', orderId).maybeSingle();
  if (voiceOrder) return { order: voiceOrder, orderType: 'voice' as const };

  const { data: musicOrder } = await db.from('music_orders').select('*').eq('id', orderId).maybeSingle();
  if (musicOrder) return { order: musicOrder, orderType: 'music' as const };

  const { data: orchestraOrder } = await db
    .from('orchestra_orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  if (orchestraOrder) return { order: orchestraOrder, orderType: 'orchestra' as const };

  return null;
}

function isPaid(order: any): boolean {
  return order?.status === 'paid' || order?.payment_status === 'paid' || order?.payment_status === 'completed';
}

function buildCheckoutLandingUrl(request: NextRequest, successUrl?: string): string {
  const fallbackOrigin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    request.headers.get('origin') ||
    request.nextUrl.origin;

  let locale = 'en';
  if (typeof successUrl === 'string' && successUrl.startsWith('http')) {
    try {
      const url = new URL(successUrl);
      const firstSegment = url.pathname.split('/').filter(Boolean)[0];
      if (firstSegment && ['en', 'zh-TW', 'zh-CN'].includes(firstSegment)) {
        locale = firstSegment;
      }
    } catch {
      // Ignore parse errors and keep fallback locale.
    }
  }

  return `${fallbackOrigin.replace(/\/$/, '')}/${locale}/paddle-checkout`;
}

export async function POST(request: NextRequest) {
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server payment configuration is incomplete' }, { status: 500 });
    }

    const body = await request.json();
    const { orderId, billingDetails, licenseeDetails, successUrl, cancelUrl } = body ?? {};

    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    const resolved = await resolveOrder(orderId);
    if (!resolved) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const { order, orderType } = resolved;
    if (isPaid(order)) {
      return NextResponse.json({ error: 'Order has already been paid' }, { status: 409 });
    }

    const amount = Number(order.price);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Order amount is invalid or missing' }, { status: 409 });
    }

    const { checkoutUrl, transactionId } = await createHostedCheckout({
      orderId,
      orderNumber: order.order_number || orderId,
      orderType,
      amount,
      billingDetails,
      licenseeDetails,
      checkoutBaseUrl: buildCheckoutLandingUrl(request, successUrl),
    });

    const hostedUrl = new URL(checkoutUrl);
    if (typeof successUrl === 'string' && successUrl.startsWith('http')) {
      hostedUrl.searchParams.set('success_url', successUrl);
    }
    if (typeof cancelUrl === 'string' && cancelUrl.startsWith('http')) {
      hostedUrl.searchParams.set('cancel_url', cancelUrl);
    }

    return NextResponse.json({
      checkoutUrl: hostedUrl.toString(),
      transactionId,
      orderId,
    });
  } catch (error) {
    console.error('[Paddle Checkout] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create Paddle checkout session',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
