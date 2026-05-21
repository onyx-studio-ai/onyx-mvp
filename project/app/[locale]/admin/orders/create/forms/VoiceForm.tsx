'use client';

import { useState, useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, CheckCircle, Send, DollarSign } from 'lucide-react';
import PaymentDetailsBlock, { type PaymentDetailsValue } from '../PaymentDetailsBlock';

const LANGUAGES = [
  'English', 'Mandarin Chinese', 'Cantonese', 'Japanese', 'Korean', 'Thai',
  'Vietnamese', 'Indonesian', 'Malay', 'Tagalog (Filipino)', 'Hindi', 'Tamil',
  'Bengali', 'Arabic', 'Persian (Farsi)', 'Spanish', 'Portuguese', 'French',
  'German', 'Italian', 'Dutch', 'Russian', 'Polish', 'Turkish', 'Swedish',
  'Norwegian', 'Danish', 'Finnish',
];

const USE_CASES = [
  'Advertisement', 'Social Media', 'Corporate', 'Broadcast',
  'E-Learning', 'Podcast', 'Audiobook', 'IVR',
];

interface Talent {
  id: string;
  name: string;
  email: string;
}

type SuccessState = { orderId: string; orderNumber: string; emailSent?: boolean; emailError?: string };

export default function VoiceForm() {
  const router = useRouter();
  const [talents, setTalents] = useState<Talent[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    email: '',
    projectName: '',
    language: 'English',
    scriptText: '',
    price: '',
    talentId: '',
    toneStyle: '',
    useCase: 'Advertisement',
    paymentMethod: 'send_invoice' as 'send_invoice' | 'already_paid',
  });
  const [payment, setPayment] = useState<PaymentDetailsValue>({
    paymentChannel: 'bank_transfer',
    paymentReference: '',
    paymentNotes: '',
  });

  useEffect(() => {
    async function fetchTalents() {
      const { data } = await supabase
        .from('talents')
        .select('id, name, email')
        .in('type', ['voice_actor', 'VO', 'Singer'])
        .eq('is_active', true)
        .order('name');
      if (data) setTalents(data);
    }
    fetchTalents();
  }, []);

  const update = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.email.trim()) return setError('Client email is required');
    if (!form.language) return setError('Language is required');
    if (!form.scriptText.trim()) return setError('Script is required');
    if (!form.price || Number(form.price) <= 0) return setError('Valid price is required');

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          projectName: form.projectName,
          language: form.language,
          scriptText: form.scriptText,
          price: Number(form.price),
          talentId: form.talentId || null,
          toneStyle: form.toneStyle,
          useCase: form.useCase,
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
          setForm({ ...form, email: '', projectName: '', scriptText: '', price: '', talentId: '', toneStyle: '' });
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
            placeholder="e.g. Brand Campaign 2026"
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
          <label className="block text-sm font-medium text-gray-700 mb-2">Language *</label>
          <select
            value={form.language}
            onChange={(e) => update('language', e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:border-amber-500 focus:outline-none"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Use Case</label>
          <select
            value={form.useCase}
            onChange={(e) => update('useCase', e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:border-amber-500 focus:outline-none"
          >
            {USE_CASES.map((uc) => (
              <option key={uc} value={uc}>{uc}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tone / Style (Optional)</label>
          <input
            type="text"
            value={form.toneStyle}
            onChange={(e) => update('toneStyle', e.target.value)}
            placeholder="e.g. Warm, Authoritative"
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Assign Talent (Optional)</label>
          <select
            value={form.talentId}
            onChange={(e) => update('talentId', e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:border-amber-500 focus:outline-none"
          >
            <option value="">— Assign later —</option>
            {talents.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Script *</label>
        <textarea
          value={form.scriptText}
          onChange={(e) => update('scriptText', e.target.value)}
          placeholder="Paste the full script here..."
          rows={6}
          className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none resize-y"
          required
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
          'Create Voice Order'
        )}
      </button>
    </form>
  );
}

export function PaymentChoice({
  form,
  update,
}: {
  form: { paymentMethod: 'send_invoice' | 'already_paid' };
  update: (key: string, value: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-3">Payment Method *</label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => update('paymentMethod', 'send_invoice')}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            form.paymentMethod === 'send_invoice'
              ? 'border-blue-300 bg-blue-50'
              : 'border-gray-300 hover:border-gray-500'
          }`}
        >
          <div className="flex items-center gap-3 mb-1.5">
            <Send className={`w-4 h-4 ${form.paymentMethod === 'send_invoice' ? 'text-blue-700' : 'text-gray-500'}`} />
            <span className="text-gray-900 font-semibold text-sm">Send Invoice</span>
          </div>
          <p className="text-gray-500 text-xs">Client pays online via Dashboard. Email notification sent.</p>
        </button>
        <button
          type="button"
          onClick={() => update('paymentMethod', 'already_paid')}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            form.paymentMethod === 'already_paid'
              ? 'border-emerald-300 bg-emerald-50'
              : 'border-gray-300 hover:border-gray-500'
          }`}
        >
          <div className="flex items-center gap-3 mb-1.5">
            <CheckCircle className={`w-4 h-4 ${form.paymentMethod === 'already_paid' ? 'text-emerald-700' : 'text-gray-500'}`} />
            <span className="text-gray-900 font-semibold text-sm">Already Paid (Offline)</span>
          </div>
          <p className="text-gray-500 text-xs">電匯 / Alipay / WeChat / Wise — bypasses Paddle, no 5% fee.</p>
        </button>
      </div>
    </div>
  );
}

export function SuccessPanel({
  success,
  isPaid,
  onReset,
  onViewAll,
}: {
  success: SuccessState;
  isPaid: boolean;
  onReset: () => void;
  onViewAll: () => void;
}) {
  return (
    <div className="p-6 md:p-10 flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-emerald-700" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Order Created</h2>
        <p className="text-gray-600">
          <span className="font-mono text-emerald-700">{success.orderNumber}</span>
        </p>
        <p className="text-gray-500 text-sm">
          {isPaid
            ? 'Order is marked as paid. Production can begin.'
            : 'Invoice sent to client. Awaiting payment.'}
        </p>
        {success.emailSent === false && (
          <p className="text-amber-700 text-xs mt-1">
            Warning: Email could not be sent to client. {success.emailError || 'Check server logs.'}
          </p>
        )}
        {success.emailSent === true && (
          <p className="text-emerald-700 text-xs mt-1">
            Notification email sent to client successfully.
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onViewAll}
            className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-900 text-sm font-medium rounded-lg transition-colors"
          >
            View All Orders
          </button>
          <button
            onClick={onReset}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Create Another
          </button>
        </div>
      </div>
    </div>
  );
}
