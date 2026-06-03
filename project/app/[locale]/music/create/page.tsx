'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter, Link } from '@/i18n/navigation';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { ArrowLeft, Music, Loader2, CreditCard, Sparkles, Waves, Zap, Briefcase, Gamepad2, Edit3, Play, Pause, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { audioManager } from '@/lib/audioManager';
import Footer from '@/components/landing/Footer';
import type { LucideIcon } from 'lucide-react';

const STORAGE_BASE = 'https://hnblwckpnapsdladcjql.supabase.co/storage/v1/object/public/music-samples/covers';

type VibeKey = 'cinematic' | 'chill' | 'epic' | 'corporate' | 'game' | 'custom';
type LengthKey = '15' | '30' | '60' | '120';
type LicenseKey = 'standard' | 'buyout';
type UsageKey =
  | 'social_media'
  | 'advertisement'
  | 'video_film'
  | 'game'
  | 'podcast'
  | 'personal'
  | 'other';

const VIBES: { key: VibeKey; icon: LucideIcon; label: string; tagline: string }[] = [
  { key: 'cinematic', icon: Sparkles, label: 'Cinematic', tagline: 'Sweeping, dramatic, orchestral' },
  { key: 'chill', icon: Waves, label: 'Chill / Lo-Fi', tagline: 'Mellow, atmospheric, lounge' },
  { key: 'epic', icon: Zap, label: 'Epic / Trailer', tagline: 'Bold, hybrid, hits hard' },
  { key: 'corporate', icon: Briefcase, label: 'Corporate', tagline: 'Clean, uplifting, motivational' },
  { key: 'game', icon: Gamepad2, label: 'Game / Action', tagline: 'Driving, energetic, looping' },
  { key: 'custom', icon: Edit3, label: 'Custom', tagline: 'Describe your own' },
];

const LENGTHS: { key: LengthKey; label: string; subtitle: string }[] = [
  { key: '15', label: '0:15', subtitle: 'Short' },
  { key: '30', label: '0:30', subtitle: 'Standard' },
  { key: '60', label: '1:00', subtitle: 'Long' },
  { key: '120', label: '2:00', subtitle: 'Extended' },
];

const USAGES: { key: UsageKey; label: string }[] = [
  { key: 'social_media', label: 'Social Media (TikTok / Reels / Shorts)' },
  { key: 'advertisement', label: 'Advertisement (TV / Online ads)' },
  { key: 'video_film', label: 'Video / Film Soundtrack' },
  { key: 'game', label: 'Game Soundtrack' },
  { key: 'podcast', label: 'Podcast Intro / Outro' },
  { key: 'personal', label: 'Personal / Hobby (lower price)' },
  { key: 'other', label: 'Other' },
];

// Pricing matrix: USD. Wing can tune.
const PRICING: Record<LengthKey, Record<LicenseKey, number>> = {
  '15':  { standard: 49,  buyout: 199 },
  '30':  { standard: 99,  buyout: 499 },
  '60':  { standard: 149, buyout: 799 },
  '120': { standard: 199, buyout: 1499 },
};

// Personal usage gets 30% off standard, buyout not available.
const PERSONAL_DISCOUNT = 0.7;

interface FormState {
  vibe: VibeKey | null;
  vibeCustom: string;
  referenceLink: string;
  length: LengthKey | null;
  usage: UsageKey | null;
  license: LicenseKey;
  notes: string;
  email: string;
}

const INITIAL_FORM: FormState = {
  vibe: null,
  vibeCustom: '',
  referenceLink: '',
  length: null,
  usage: null,
  license: 'standard',
  notes: '',
  email: '',
};

function MusicCreatePageInner() {
  const router = useRouter();
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  // Pick up ?track= and ?trackTitle= from the catalog so we can show the
  // user the reference track they chose. The slot_key drives both the
  // audio playback (looked up against audio_showcases) and the cover
  // image URL (predictable path under music-samples/covers/).
  const searchParams = useSearchParams();
  const trackSlug = searchParams.get('track') || '';
  const trackTitle = searchParams.get('trackTitle') || '';

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [emailPrefilled, setEmailPrefilled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Preview state for the picked reference track.
  const [trackAudioUrl, setTrackAudioUrl] = useState('');
  const [trackPlaying, setTrackPlaying] = useState(false);
  const [trackAudio, setTrackAudio] = useState<HTMLAudioElement | null>(null);

  // Prefill email from auth session if logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setForm((f) => (f.email ? f : { ...f, email: session.user.email || '' }));
        setEmailPrefilled(Boolean(session.user.email));
      }
    });
  }, []);

  // Load the picked track's audio_url so the user can preview the reference
  // they brought from the catalog. Also seed the form's reference_link
  // field with the slot_key so the producer can identify it later.
  useEffect(() => {
    if (!trackSlug) return;
    supabase
      .from('audio_showcases')
      .select('audio_url')
      .eq('section', 'music_library')
      .eq('slot_key', trackSlug)
      .single()
      .then(({ data }) => {
        if (data?.audio_url) setTrackAudioUrl(data.audio_url);
      });
    // Seed reference_link with a human-readable handle so the producer
    // sees "catalog:Spark Up (brand-sting-1)" in the order. Don't
    // overwrite if the user has already typed something.
    setForm(f => f.referenceLink
      ? f
      : { ...f, referenceLink: `catalog:${trackTitle || trackSlug} (${trackSlug})` }
    );
    return () => {
      if (trackAudio) {
        trackAudio.pause();
        audioManager.stop(trackAudio);
      }
    };
  }, [trackSlug, trackTitle]);

  const toggleTrackPlay = () => {
    if (!trackAudioUrl) return;
    if (trackPlaying) {
      trackAudio?.pause();
      if (trackAudio) audioManager.stop(trackAudio);
      setTrackPlaying(false);
      return;
    }
    let a = trackAudio;
    if (!a) {
      a = new Audio(trackAudioUrl);
      a.onended = () => setTrackPlaying(false);
      setTrackAudio(a);
    }
    audioManager.play(a, () => setTrackPlaying(false));
    a.play();
    setTrackPlaying(true);
  };

  const isPersonal = form.usage === 'personal';
  const effectiveLicense: LicenseKey = isPersonal ? 'standard' : form.license;

  const price = useMemo(() => {
    if (!form.length) return 0;
    const base = PRICING[form.length][effectiveLicense];
    return isPersonal ? Math.round(base * PERSONAL_DISCOUNT) : base;
  }, [form.length, effectiveLicense, isPersonal]);

  const canSubmit =
    !!form.email.trim() &&
    !!form.vibe &&
    (form.vibe !== 'custom' || form.vibeCustom.trim().length > 0) &&
    !!form.length &&
    !!form.usage &&
    price > 0;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setError('');
  }

  async function handleSubmit() {
    if (!canSubmit) {
      setError('Please fill all required fields');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const orderNumber = `MO-${Date.now()}`;
      const vibeLabel =
        form.vibe === 'custom'
          ? form.vibeCustom
          : VIBES.find((v) => v.key === form.vibe)?.label || form.vibe || '';
      const usageLabel = USAGES.find((u) => u.key === form.usage)?.label || form.usage || '';

      const description = [
        `Length: ${form.length}s`,
        `License: ${effectiveLicense}`,
        form.notes ? `Notes: ${form.notes}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      // 1. Create music order in DB
      const orderRes = await fetch('/api/orders/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          project_name: null,
          vibe: vibeLabel,
          reference_link: form.referenceLink,
          usage_type: usageLabel,
          description,
          tier: 'ai-curator',
          price,
          status: 'pending_payment',
          payment_status: 'pending',
          order_number: orderNumber,
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Failed to create order');

      const orderId = orderData.id;

      // 2. Kick off Paddle hosted checkout
      const checkoutRes = await fetch('/api/payment/paddle/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          billingDetails: { email: form.email },
          successUrl: `${window.location.origin}/checkout/success?id=${orderId}`,
        }),
      });

      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok) throw new Error(checkoutData.error || 'Failed to create checkout');

      window.location.href = checkoutData.checkoutUrl;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white pt-28 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => router.push('/music')}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Music
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium mb-4">
            <Music className="w-3.5 h-3.5" />
            New AI Music Project
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-white via-emerald-100 to-white bg-clip-text text-transparent">
            Tell us your vibe.
          </h1>
          <p className="text-gray-400 text-lg">
            AI-generated, finessed by Onyx producers. 24–48 hour delivery.
          </p>
        </motion.div>

        {/* Reference track the user picked from the catalog. Shown as a
            preview card with audio playback so they can re-validate the
            choice while filling out the configurator. The slot_key is
            already seeded into form.referenceLink so the producer gets
            it on the order. */}
        {trackSlug && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-pink-500/10 border border-amber-500/30 flex items-center gap-3">
            <div className="relative shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-zinc-800">
              <img
                src={`${STORAGE_BASE}/${trackSlug}.jpg`}
                alt={trackTitle || trackSlug}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
              {trackPlaying && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-amber-400 uppercase tracking-widest font-semibold">
                {tx('起點曲目參考', '起点曲目参考', 'Starting reference')}
              </p>
              <p className="text-sm font-semibold truncate">{trackTitle || trackSlug}</p>
              <p className="text-[11px] text-gray-500 truncate">{trackSlug}</p>
            </div>
            {trackAudioUrl && (
              <button
                type="button"
                onClick={toggleTrackPlay}
                className="shrink-0 w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition shadow-md"
                aria-label={trackPlaying ? 'Pause' : 'Play'}
              >
                {trackPlaying ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4 ml-0.5" fill="currentColor" />}
              </button>
            )}
          </div>
        )}

        {/* Pointer to the brief flow for users who realize Tier 1 isn't
            enough. Better to offer the off-ramp here than have them check
            out at the wrong tier and request a refund later. */}
        <div className="mb-8 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 text-gray-300">
            <FileText className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              {tx(
                '需要真人製作或 Live 弦樂?(Tier 2 / 3)',
                '需要真人制作或 Live 弦乐?(Tier 2 / 3)',
                'Need a human producer or live strings? (Tier 2 / 3)'
              )}
            </span>
          </div>
          <Link
            href={`/music/brief${trackSlug ? `?track=${trackSlug}&trackTitle=${encodeURIComponent(trackTitle)}` : ''}`}
            className="shrink-0 px-3 py-1.5 rounded-full bg-amber-500 text-black text-xs font-semibold hover:bg-amber-400 transition"
          >
            {tx('送出詢價 →', '送出询价 →', 'Send brief →')}
          </Link>
        </div>

        {/* Email */}
        <Section title="Your email" required>
          <input
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            disabled={emailPrefilled}
            placeholder="you@company.com"
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-gray-600 focus:border-emerald-500/50 focus:outline-none transition-colors disabled:opacity-60"
          />
          {emailPrefilled && (
            <p className="text-xs text-gray-500 mt-2">Logged in as {form.email}</p>
          )}
        </Section>

        {/* Vibe */}
        <Section title="1. Vibe / Style" required>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {VIBES.map(({ key, icon: Icon, label, tagline }) => {
              const active = form.vibe === key;
              return (
                <button
                  key={key}
                  onClick={() => update('vibe', key)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    active
                      ? 'border-emerald-500/60 bg-emerald-500/10'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-2 ${active ? 'text-emerald-300' : 'text-gray-400'}`} />
                  <div className={`font-semibold text-sm ${active ? 'text-white' : 'text-gray-200'}`}>
                    {label}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 leading-snug">{tagline}</div>
                </button>
              );
            })}
          </div>

          {form.vibe === 'custom' && (
            <textarea
              value={form.vibeCustom}
              onChange={(e) => update('vibeCustom', e.target.value)}
              placeholder="Describe the vibe you want..."
              rows={2}
              className="w-full mt-3 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:border-emerald-500/50 focus:outline-none resize-y"
            />
          )}

          <input
            type="url"
            value={form.referenceLink}
            onChange={(e) => update('referenceLink', e.target.value)}
            placeholder="Optional: Spotify / YouTube reference link"
            className="w-full mt-3 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:border-emerald-500/50 focus:outline-none text-sm"
          />
        </Section>

        {/* Length */}
        <Section title="2. Length" required>
          <div className="grid grid-cols-4 gap-3">
            {LENGTHS.map(({ key, label, subtitle }) => {
              const active = form.length === key;
              return (
                <button
                  key={key}
                  onClick={() => update('length', key)}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${
                    active
                      ? 'border-emerald-500/60 bg-emerald-500/10'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className={`font-bold text-lg ${active ? 'text-white' : 'text-gray-200'}`}>
                    {label}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Usage */}
        <Section title="3. Usage" required>
          <select
            value={form.usage || ''}
            onChange={(e) => update('usage', e.target.value as UsageKey)}
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3.5 text-white focus:border-emerald-500/50 focus:outline-none transition-colors"
          >
            <option value="" disabled className="bg-[#050505]">
              Select usage...
            </option>
            {USAGES.map(({ key, label }) => (
              <option key={key} value={key} className="bg-[#050505]">
                {label}
              </option>
            ))}
          </select>
        </Section>

        {/* License */}
        <Section title="4. License" required>
          {isPersonal ? (
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <p className="text-sm text-amber-300">
                Personal use only — non-commercial. Standard 1-year license auto-applied at 30% discount.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(['standard', 'buyout'] as LicenseKey[]).map((key) => {
                const active = form.license === key;
                const label = key === 'standard' ? '🌐 Standard' : '🏆 Buyout';
                const desc =
                  key === 'standard'
                    ? '1 year, web/social/your brand'
                    : 'Permanent, full IP transfer, you own everything';
                return (
                  <button
                    key={key}
                    onClick={() => update('license', key)}
                    className={`p-5 rounded-xl border-2 text-left transition-all ${
                      active
                        ? 'border-emerald-500/60 bg-emerald-500/10'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className={`font-semibold text-base mb-1 ${active ? 'text-white' : 'text-gray-200'}`}>
                      {label}
                    </div>
                    <div className="text-xs text-gray-400 leading-relaxed">{desc}</div>
                  </button>
                );
              })}
            </div>
          )}
        </Section>

        {/* Notes */}
        <Section title="Project notes (optional)">
          <textarea
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="Mood, instruments, scene context, deadline..."
            rows={3}
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:border-emerald-500/50 focus:outline-none resize-y"
          />
        </Section>

        {/* Total + Submit */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-10 p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent border border-emerald-500/20"
        >
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-sm text-gray-400 uppercase tracking-wider">Total</span>
            <span className="text-4xl font-bold text-white">
              {price > 0 ? `US$${price}` : '—'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-6">
            Estimated delivery: 24–48 hours after payment
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating order...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                Continue to Checkout
              </>
            )}
          </button>
        </motion.div>
      </div>

      <Footer />
    </main>
  );
}

function Section({
  title,
  required,
  children,
}: {
  title: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="mt-8"
    >
      <label className="block text-sm font-medium text-gray-300 mb-3">
        {title}
        {required && <span className="text-emerald-400 ml-1">*</span>}
      </label>
      {children}
    </motion.div>
  );
}

// useSearchParams() needs a Suspense boundary in App Router builds, even
// inside a 'use client' tree. Splitting the page into an inner component
// + a wrapping default export keeps the static-prerender path happy.
export default function MusicCreatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
      <MusicCreatePageInner />
    </Suspense>
  );
}
