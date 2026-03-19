import { NextRequest, NextResponse } from 'next/server';
import { finalizeOrderPayment } from '@/lib/payments/order-finalize';
import { verifyPaddleWebhookSignature } from '@/lib/payments/paddle';

function parseAmountFromEvent(data: any): number {
  const candidates = [
    data?.details?.totals?.total,
    data?.details?.totals?.grand_total,
    data?.totals?.total,
    data?.total,
  ];

  for (const raw of candidates) {
    const value = Number(raw);
    if (Number.isFinite(value) && value > 0) {
      // Paddle amounts are typically in cents.
      return value / 100;
    }
  }
  return 0;
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('Paddle-Signature');
  const rawBody = await request.text();

  try {
    const valid = verifyPaddleWebhookSignature(rawBody, signature);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event?.event_type as string | undefined;
    const data = event?.data ?? {};

    // Only finalize when transaction is actually completed.
    const isCompletedEvent =
      eventType === 'transaction.completed' ||
      (eventType === 'transaction.updated' && data?.status === 'completed');

    if (!isCompletedEvent) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const customData = data?.custom_data ?? {};
    const orderId = customData?.orderId as string | undefined;
    const transactionId = data?.id as string | undefined;

    if (!orderId || !transactionId) {
      return NextResponse.json(
        { error: 'Webhook missing orderId or transaction id in payload' },
        { status: 400 },
      );
    }

    const amount = parseAmountFromEvent(data);
    if (amount <= 0) {
      return NextResponse.json({ error: 'Invalid transaction amount from webhook' }, { status: 400 });
    }

    const result = await finalizeOrderPayment({
      orderId,
      transactionId,
      amount,
      billingDetails: customData?.billingDetails,
      licenseeDetails: customData?.licenseeDetails,
    });

    return NextResponse.json({
      received: true,
      processed: true,
      orderId,
      orderNumber: result.orderNumber,
      alreadyPaid: result.alreadyPaid,
    });
  } catch (error) {
    console.error('[Paddle Webhook] Error:', error);
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
