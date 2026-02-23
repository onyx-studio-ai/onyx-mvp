'use client';

import { useState, useEffect } from 'react';
import { useRouter, Link } from '@/i18n/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Loader2, CheckCircle, Send, DollarSign, Mic } from 'lucide-react';

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

export default function CreateTier3OrderPage() {
  const router = useRouter();
  const [talents, setTalents] = useState<Talent[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ orderId: string; orderNumber: string; emailSent?: boolean; emailError?: string } | null>(null);
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
    setForm(prev => ({ ...prev, [key]: value }));
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create order');
      setSuccess({ orderId: data.orderId, orderNumber: data.orderNumber, emailSent: data.emailSent, emailError: data.emailError });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="p-6 md:p-10 flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Order Created</h2>
          <p className="text-gray-400">
            <span className="font-mono text-emerald-400">{success.orderNumber}</span>
          </p>
          <p className="text-gray-500 text-sm">
            {form.paymentMethod === 'already_paid'
              ? 'Order is marked as paid. Production can begin.'
              : 'Invoice sent to client. Awaiting payment.'}
          </p>
          {success.emailSent === false && (
            <p className="text-amber-400 text-xs mt-1">
              Warning: Email could not be sent to client. {success.emailError || 'Check server logs for details.'}
            </p>
          )}
          {success.emailSent === true && (
            <p className="text-emerald-400 text-xs mt-1">
              Notification email sent to client successfully.
            </p>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push('/admin/orders')}
              className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              View All Orders
            </button>
            <button
              onClick={() => { setSuccess(null); setForm({ ...form, email: '', projectName: '', scriptText: '', price: '', talentId: '', toneStyle: '' }); }}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Create Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto">
      <Link href="/admin/orders" className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Orders
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Mic className="w-7 h-7 text-amber-400" />
          New 100% Live Studio Order
        </h1>
        <p className="text-gray-500 text-sm mt-1">Create a Tier 3 voice order with custom pricing</p>
        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
          Global TV & Game Rights — Full IP Buyout (Locked)
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client Email */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Client Email *</label>
          <input
            type="email"
            value={form.email}
            onChange={e => update('email', e.target.value)}
            placeholder="client@company.com"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:border-amber-500 focus:outline-none"
            required
          />
        </div>

        {/* Project Name + Price */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Project Name (Optional)</label>
            <input
              type="text"
              value={form.projectName}
              onChange={e => update('projectName', e.target.value)}
              placeholder="e.g. Brand Campaign 2026"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Price (USD) *</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="number"
                min="1"
                step="1"
                value={form.price}
                onChange={e => update('price', e.target.value)}
                placeholder="Custom price"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-9 pr-4 py-3 text-white placeholder:text-gray-600 focus:border-amber-500 focus:outline-none"
                required
              />
            </div>
          </div>
        </div>

        {/* Language + Use Case */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Language *</label>
            <select
              value={form.language}
              onChange={e => update('language', e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
            >
              {LANGUAGES.map(lang => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Use Case</label>
            <select
              value={form.useCase}
              onChange={e => update('useCase', e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
            >
              {USE_CASES.map(uc => (
                <option key={uc} value={uc}>{uc}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tone + Talent */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Tone / Style (Optional)</label>
            <input
              type="text"
              value={form.toneStyle}
              onChange={e => update('toneStyle', e.target.value)}
              placeholder="e.g. Warm, Authoritative"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Assign Talent (Optional)</label>
            <select
              value={form.talentId}
              onChange={e => update('talentId', e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
            >
              <option value="">— Assign later —</option>
              {talents.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Script */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Script *</label>
          <textarea
            value={form.scriptText}
            onChange={e => update('scriptText', e.target.value)}
            placeholder="Paste the full script here..."
            rows={6}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:border-amber-500 focus:outline-none resize-y"
            required
          />
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">Payment Method *</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => update('paymentMethod', 'send_invoice')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                form.paymentMethod === 'send_invoice'
                  ? 'border-blue-500/50 bg-blue-500/10'
                  : 'border-zinc-700 hover:border-zinc-500'
              }`}
            >
              <div className="flex items-center gap-3 mb-1.5">
                <Send className={`w-4 h-4 ${form.paymentMethod === 'send_invoice' ? 'text-blue-400' : 'text-gray-500'}`} />
                <span className="text-white font-semibold text-sm">Send Invoice</span>
              </div>
              <p className="text-gray-500 text-xs">Client pays online via Dashboard. Email notification sent.</p>
            </button>
            <button
              type="button"
              onClick={() => update('paymentMethod', 'already_paid')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                form.paymentMethod === 'already_paid'
                  ? 'border-emerald-500/50 bg-emerald-500/10'
                  : 'border-zinc-700 hover:border-zinc-500'
              }`}
            >
              <div className="flex items-center gap-3 mb-1.5">
                <CheckCircle className={`w-4 h-4 ${form.paymentMethod === 'already_paid' ? 'text-emerald-400' : 'text-gray-500'}`} />
                <span className="text-white font-semibold text-sm">Already Paid</span>
              </div>
              <p className="text-gray-500 text-xs">Payment received offline. Order enters production immediately.</p>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
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
            'Create Tier 3 Order'
          )}
        </button>
      </form>
    </div>
  );
}
