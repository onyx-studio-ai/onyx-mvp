import crypto from 'crypto';
import { PADDLE_CONFIG } from '@/lib/config';

const PADDLE_API_BASE =
  PADDLE_CONFIG.environment === 'production'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com';

function getRequiredPaddleConfig() {
  const { apiKey, webhookSecret } = PADDLE_CONFIG;
  if (!apiKey) {
    throw new Error('PADDLE_API_KEY is missing');
  }
  if (!webhookSecret) {
    throw new Error('PADDLE_WEBHOOK_SECRET is missing');
  }
  return { apiKey, webhookSecret };
}

export async function createHostedCheckout(params: {
  orderId: string;
  orderNumber: string;
  orderType: 'voice' | 'music' | 'orchestra';
  amount: number;
  billingDetails?: Record<string, unknown>;
  licenseeDetails?: Record<string, unknown>;
}) {
  const { apiKey } = getRequiredPaddleConfig();
  const {
    orderId,
    orderNumber,
    orderType,
    amount,
    billingDetails,
    licenseeDetails,
  } = params;

  const normalizedAmount = Math.round(amount * 100).toString();
  if (!Number.isFinite(Number(normalizedAmount)) || Number(normalizedAmount) <= 0) {
    throw new Error('Invalid amount for Paddle transaction');
  }

  const payload = {
    currency_code: 'USD',
    collection_mode: 'automatic',
    custom_data: {
      orderId,
      orderNumber,
      orderType,
      billingDetails: billingDetails || null,
      licenseeDetails: licenseeDetails || null,
    },
    items: [
      {
        quantity: 1,
        price: {
          name: `${orderType.toUpperCase()} Order ${orderNumber}`,
          description: `Order #${orderNumber}`,
          unit_price: {
            amount: normalizedAmount,
            currency_code: 'USD',
          },
          product: {
            name: `${orderType.toUpperCase()} Production`,
            tax_category: 'standard',
          },
        },
      },
    ],
  };

  const response = await fetch(`${PADDLE_API_BASE}/transactions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    const detail = data?.error?.detail || data?.error?.message || 'Unknown Paddle API error';
    throw new Error(`Paddle create transaction failed: ${detail}`);
  }

  const checkoutUrl = data?.data?.checkout?.url;
  const transactionId = data?.data?.id;
  if (!checkoutUrl || !transactionId) {
    throw new Error('Paddle response missing checkout URL or transaction ID');
  }

  return { checkoutUrl, transactionId };
}

export function verifyPaddleWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const { webhookSecret } = getRequiredPaddleConfig();
  if (!signatureHeader) return false;

  const segments = signatureHeader.split(';').map((part) => part.trim());
  const tsPart = segments.find((s) => s.startsWith('ts='));
  const h1Part = segments.find((s) => s.startsWith('h1='));

  if (!tsPart || !h1Part) return false;

  const timestamp = tsPart.replace('ts=', '');
  const signature = h1Part.replace('h1=', '');
  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}:${rawBody}`;
  const computed = crypto.createHmac('sha256', webhookSecret).update(signedPayload, 'utf8').digest('hex');

  const incoming = Buffer.from(signature, 'hex');
  const expected = Buffer.from(computed, 'hex');
  if (incoming.length !== expected.length) return false;
  return crypto.timingSafeEqual(incoming, expected);
}
