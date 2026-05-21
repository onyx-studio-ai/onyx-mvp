/**
 * Shared payment method definitions for manual orders.
 *
 * `paddle` is reserved for orders that flowed through the public Paddle
 * checkout (webhook-marked paid). `admin_manual` is the legacy bucket for
 * tier-3 orders the admin created before the explicit payment_method column
 * existed. Everything else represents a real off-platform payment channel
 * the admin needs to reconcile against bank/Alipay/WeChat/etc statements.
 */

export type PaymentMethod =
  | 'paddle'
  | 'admin_manual'
  | 'bank_transfer'
  | 'alipay'
  | 'wechat_pay'
  | 'wise'
  | 'payoneer'
  | 'paypal'
  | 'cash'
  | 'other';

export const OFFLINE_PAYMENT_METHODS: PaymentMethod[] = [
  'bank_transfer',
  'alipay',
  'wechat_pay',
  'wise',
  'payoneer',
  'paypal',
  'cash',
  'other',
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, { en: string; zh: string }> = {
  paddle: { en: 'Paddle (online)', zh: 'Paddle 線上付款' },
  admin_manual: { en: 'Admin manual (legacy)', zh: '後台手動建立（既有）' },
  bank_transfer: { en: 'Bank transfer / Wire', zh: '銀行電匯' },
  alipay: { en: 'Alipay', zh: '支付寶' },
  wechat_pay: { en: 'WeChat Pay', zh: '微信支付' },
  wise: { en: 'Wise', zh: 'Wise' },
  payoneer: { en: 'Payoneer', zh: 'Payoneer' },
  paypal: { en: 'PayPal', zh: 'PayPal' },
  cash: { en: 'Cash', zh: '現金' },
  other: { en: 'Other', zh: '其他' },
};

export function isValidPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && value in PAYMENT_METHOD_LABELS;
}

export function paymentMethodLabel(method: PaymentMethod | null | undefined, locale: 'en' | 'zh' = 'en'): string {
  if (!method) return locale === 'zh' ? '未指定' : 'Unknown';
  const entry = PAYMENT_METHOD_LABELS[method];
  return entry ? entry[locale] : method;
}
