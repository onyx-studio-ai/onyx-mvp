'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Loader2, DollarSign } from 'lucide-react';
import PaymentDetailsBlock, { type PaymentDetailsValue } from '../PaymentDetailsBlock';
import { PaymentChoice, SuccessPanel } from './VoiceForm';

const USAGE_TYPES = [
  'Trailer',
  'Film/TV',
  'Game',
  'Commercial',
  'Concert / Album',
  'Personal',
  'Other',
];

const TIERS = [
  { value: 'tier1', name: 'Demo Recording' },
  { value: 'tier2', name: 'Indie Production' },
  { value: 'tier3', name: 'Television Standard' },
  { value: 'tier4', name: 'Cinema Premium' },
];

type SuccessState = { orderId: string; orderNumber: string; emailSent?: boolean; emailError?: string };

export default function OrchestraForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    email: '',
    projectName: '',
    tier: 'tier3',
    durationMinutes: '',
    genre: '',
    description: '',
    referenceUrl: '',
    usageType: 'Trailer',
    price: '',
    paymentMethod: 'send_invoice' as 'send_invoice' | 'already_paid',
  });
  const [payment, setPayment] = useState<PaymentDetailsValue>({
    paymentChannel: 'bank_transfer',
    paymentReference: '',
    paymentNotes: '',
  });

  const tierName = TIERS.find((t) => t.value === form.tier)?.name || 'Television Standard';

  const update = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.email.trim()) return setError('Client email is required');
    if (!form.price || Number(form.price) <= 0) return setError('Valid price is required');

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/orders/create-orchestra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          projectName: form.projectName,
          tier: form.tier,
          tierName,
          durationMinutes: Number(form.durationMinutes) || 0,
          genre: form.genre,
          description: form.description,
          referenceUrl: form.referenceUrl,
          usageType: form.usageType,
          price: Number(form.price),
          paymentMethod: form.paymentMethod,
          paymentChannel: form.paymentMethod === 'already_paid' ? payment.paymentChannel : undefined,
          paymentReference: form.paymentMethod === 'already_paid' ? payment.paymentReference : undefined,
          paymentNotes: form.paymentMethod === 'already_paid' ? payment.paymentNotes : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create order');
      setSuccess({
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        emailSent: data.emailSent,
        emailError: data.emailError,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <SuccessPanel
        success={success}
        isPaid={form.paymentMethod === 'already_paid'}
        onReset={() => {
          setSuccess(null);
          setForm({ ...form, email: '', projectName: '', durationMinutes: '', genre: '', description: '', referenceUrl: '', price: '' });
          setPayment({ paymentChannel: 'bank_transfer', paymentReference: '', paymentNotes: '' });
        }}
        onViewAll={() => router.push('/admin/orders')}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Client Email *</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          placeholder="client@company.com"
          className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none"
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Project Name (Optional)</label>
          <input
            type="text"
            value={form.projectName}
            onChange={(e) => update('projectName', e.target.value)}
            placeholder="e.g. Trailer Score 2026"
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Price (USD) *</label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="number"
              min="1"
              step="1"
              value={form.price}
              onChange={(e) => update('price', e.target.value)}
              placeholder="Custom price"
              className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none"
              required
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tier</label>
          <select
            value={form.tier}
            onChange={(e) => update('tier', e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:border-amber-500 focus:outline-none"
          >
            {TIERS.map((t) => (
              <option key={t.value} value={t.value}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Duration (min)</label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={form.durationMinutes}
            onChange={(e) => update('durationMinutes', e.target.value)}
            placeholder="e.g. 5.5"
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Usage Type</label>
          <select
            value={form.usageType}
            onChange={(e) => update('usageType', e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:border-amber-500 focus:outline-none"
          >
            {USAGE_TYPES.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Genre (Optional)</label>
        <input
          type="text"
          value={form.genre}
          onChange={(e) => update('genre', e.target.value)}
          placeholder="e.g. Epic Orchestral, Chamber Strings, Hybrid"
          className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
        <textarea
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder="Brief, mood, ensemble size, scene context..."
          rows={4}
          className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none resize-y"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Reference URL (Optional)</label>
        <input
          type="url"
          value={form.referenceUrl}
          onChange={(e) => update('referenceUrl', e.target.value)}
          placeholder="https://..."
          className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none"
        />
      </div>

      <PaymentChoice form={form} update={update} />
      {form.paymentMethod === 'already_paid' && (
        <PaymentDetailsBlock value={payment} onChange={setPayment} />
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {submitting ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Creating Order...</>
        ) : (
          'Create Orchestra Order'
        )}
      </button>
    </form>
  );
}
