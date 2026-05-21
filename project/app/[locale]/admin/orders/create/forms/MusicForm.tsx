'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Loader2, DollarSign } from 'lucide-react';
import PaymentDetailsBlock, { type PaymentDetailsValue } from '../PaymentDetailsBlock';
import { PaymentChoice, SuccessPanel } from './VoiceForm';

const USAGE_TYPES = [
  'Film/TV Production',
  'Advertisement',
  'Game',
  'Corporate Video',
  'Social Media',
  'Podcast / Show',
  'Personal',
  'Other',
];

const TIERS = [
  { value: 'ai-curator', label: 'AI Curator (Tier 1)' },
  { value: 'human-curator', label: 'Human Curator (Tier 2)' },
  { value: 'bespoke', label: 'Bespoke Composer (Tier 3)' },
];

type SuccessState = { orderId: string; orderNumber: string; emailSent?: boolean; emailError?: string };

export default function MusicForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    email: '',
    projectName: '',
    vibe: '',
    usageType: 'Film/TV Production',
    description: '',
    referenceLink: '',
    tier: 'human-curator',
    price: '',
    paymentMethod: 'send_invoice' as 'send_invoice' | 'already_paid',
  });
  const [payment, setPayment] = useState<PaymentDetailsValue>({
    paymentChannel: 'bank_transfer',
    paymentReference: '',
    paymentNotes: '',
  });

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
      const res = await fetch('/api/admin/orders/create-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          projectName: form.projectName,
          vibe: form.vibe,
          usageType: form.usageType,
          description: form.description,
          referenceLink: form.referenceLink,
          tier: form.tier,
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
          setForm({ ...form, email: '', projectName: '', vibe: '', description: '', referenceLink: '', price: '' });
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
            placeholder="e.g. Documentary Score"
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tier</label>
          <select
            value={form.tier}
            onChange={(e) => update('tier', e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:border-amber-500 focus:outline-none"
          >
            {TIERS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
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
        <label className="block text-sm font-medium text-gray-700 mb-2">Vibe / Style (Optional)</label>
        <input
          type="text"
          value={form.vibe}
          onChange={(e) => update('vibe', e.target.value)}
          placeholder="e.g. Chill Lo-Fi, Cinematic Orchestral, Synthwave"
          className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
        <textarea
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder="Project brief, mood, references..."
          rows={4}
          className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none resize-y"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Reference Link (Optional)</label>
        <input
          type="url"
          value={form.referenceLink}
          onChange={(e) => update('referenceLink', e.target.value)}
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
          'Create Music Order'
        )}
      </button>
    </form>
  );
}
