'use client';

import { PAYMENT_METHOD_LABELS, OFFLINE_PAYMENT_METHODS, type PaymentMethod } from '@/lib/payments/methods';

export type PaymentDetailsValue = {
  paymentChannel: PaymentMethod;
  paymentReference: string;
  paymentNotes: string;
};

interface Props {
  value: PaymentDetailsValue;
  onChange: (next: PaymentDetailsValue) => void;
  /** Show channel options that fit B2B reconciliation (no `paddle` since it'd already be paid via webhook). */
  channels?: PaymentMethod[];
}

const DEFAULT_CHANNELS: PaymentMethod[] = [
  'bank_transfer',
  'alipay',
  'wechat_pay',
  'wise',
  'payoneer',
  'paypal',
  'cash',
  'admin_manual',
  'other',
];

export default function PaymentDetailsBlock({ value, onChange, channels = DEFAULT_CHANNELS }: Props) {
  const update = (patch: Partial<PaymentDetailsValue>) => onChange({ ...value, ...patch });
  const requireReference = OFFLINE_PAYMENT_METHODS.includes(value.paymentChannel);

  return (
    <div className="mt-3 p-4 rounded-xl bg-emerald-50/40 border border-emerald-200 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Payment Channel <span className="text-red-700">*</span>
        </label>
        <select
          value={value.paymentChannel}
          onChange={(e) => update({ paymentChannel: e.target.value as PaymentMethod })}
          className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:border-emerald-500 focus:outline-none"
        >
          {channels.map((c) => (
            <option key={c} value={c}>
              {PAYMENT_METHOD_LABELS[c]?.en} / {PAYMENT_METHOD_LABELS[c]?.zh}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Payment Reference {requireReference && <span className="text-red-700">*</span>}
        </label>
        <input
          type="text"
          value={value.paymentReference}
          onChange={(e) => update({ paymentReference: e.target.value })}
          placeholder={
            requireReference
              ? 'Bank tx ID / Alipay tx / Wise reference — required for reconciliation'
              : 'Optional reference ID'
          }
          className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none"
        />
        <p className="text-xs text-gray-500 mt-1.5">
          {requireReference
            ? '銀行交易序號、支付寶交易號、Wise reference — 對帳必填'
            : '對應的交易序號（可選）'}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Payment Notes (Optional)
        </label>
        <textarea
          value={value.paymentNotes}
          onChange={(e) => update({ paymentNotes: e.target.value })}
          rows={2}
          placeholder='e.g. "Received USD 500 from 數據堂 via Alipay 對公 on 2026/5/21"'
          className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none resize-y"
        />
        <p className="text-xs text-gray-500 mt-1.5">內部備註：對帳用，客戶看不到</p>
      </div>
    </div>
  );
}
