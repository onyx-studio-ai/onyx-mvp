'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter, Link } from '@/i18n/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Music2,
  Check,
  ChevronDown,
  Info,
  Loader2,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import Footer from '@/components/landing/Footer';
import { ORCHESTRA_TIERS } from '@/lib/config/pricing.config';

const TIER_UI = {
  tier1: { color: 'from-slate-600 to-slate-500', border: 'border-white/10', activeBorder: 'border-white/30' },
  tier2: { color: 'from-sky-700 to-sky-600', border: 'border-sky-500/20', activeBorder: 'border-sky-400/60' },
  tier3: { color: 'from-amber-600 to-amber-500', border: 'border-amber-500/40', activeBorder: 'border-amber-400/70' },
  tier4: { color: 'from-red-700 to-rose-600', border: 'border-red-500/20', activeBorder: 'border-red-400/60' },
} as const;

const TIERS = ORCHESTRA_TIERS.map(t => ({
  ...t,
  players: `${t.players} Players`,
  ...(TIER_UI[t.id as keyof typeof TIER_UI] ?? {}),
}));

const GENRE_STYLES = [
  'Cinematic / Film Score',
  'Neo-Classical',
  'Romantic Era',
  'Contemporary Classical',
  'Minimalist',
  'Epic / Trailer',
  'Pop Orchestral',
  'Jazz Strings',
  'Folk / Celtic',
  'Ambient / Textural',
  'Game Score',
  'TV / Commercial',
  'World / Ethnic',
  'Sacred / Choral',
  'Other',
];

const USAGE_TYPES = ['Film / Short Film', 'TV Series / Commercial', 'Video Game', 'Trailer', 'Album / EP', 'YouTube / Online', 'Other'];

function calcPrice(tierId: string, duration: number): number {
  const tier = TIERS.find((t) => t.id === tierId);
  if (!tier) return 0;
  if (duration <= tier.includedMinutes) return tier.basePrice;
  const extra = duration - tier.includedMinutes;
  return tier.basePrice + Math.ceil(extra) * tier.overagePerMin;
}

export default function OrchestraOrderPage() {
  const t = useTranslations('orchestra.order');
  const router = useRouter();
  const searchParams = useSearchParams();
  const preTier = searchParams.get('tier') || '';

  const [userEmail, setUserEmail] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const validTierIds = TIERS.map((t) => t.id);
  const [selectedTier, setSelectedTier] = useState(
    validTierIds.includes(preTier) ? preTier : 'tier3'
  );
  const [duration, setDuration] = useState(3);
  const [projectName, setProjectName] = useState('');
  const [genre, setGenre] = useState('');
  const [description, setDescription] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [usageType, setUsageType] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [emailConfirm, setEmailConfirm] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const price = calcPrice(selectedTier, duration);
  const tier = TIERS.find((t) => t.id === selectedTier)!;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setIsLoggedIn(true);
        setUserEmail(data.user.email || '');
        setUserId(data.user.id);
      }
    });
  }, []);

  function validate() {
    const e: Record<string, string> = {};
    const email = isLoggedIn ? userEmail : emailInput;
    if (!email) e.email = t('validationEmailRequired');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = t('validationEmailInvalid');
    if (!isLoggedIn && emailInput !== emailConfirm) e.emailConfirm = t('validationEmailMismatch');
    if (!genre) e.genre = t('validationGenreRequired');
    if (!usageType) e.usageType = t('validationUsageRequired');
    if (!description.trim()) e.description = t('validationBriefRequired');
    if (duration < 0.5) e.duration = t('validationMinDuration');
    return e;
  }

  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSubmitting(true);
    try {
      const email = isLoggedIn ? userEmail : emailInput;
      const tierObj = TIERS.find((t) => t.id === selectedTier)!;

      const res = await fetch('/api/orders/orchestra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          user_id: userId,
          project_name: projectName,
          tier: selectedTier,
          tier_name: tierObj.name,
          duration_minutes: duration,
          price,
          genre,
          description,
          reference_url: referenceUrl,
          usage_type: usageType,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || t('failedToCreateOrder'));

      router.push(`/checkout/${result.id}?type=orchestra`);
    } catch (err: unknown) {
      console.error('Orchestra order submission error:', err);
      const msg = err instanceof Error ? err.message : t('unknownError');
      setErrors({ submit: `${t('failedToSubmitOrder')}: ${msg}` });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-24 pb-32">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <Link href="/music/orchestra" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-8">
            <ArrowLeft className="w-4 h-4" />
            {t('backToLiveStrings')}
          </Link>

          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-600 to-orange-600 shadow-lg shadow-amber-600/30">
              <Music2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs text-amber-400 font-semibold tracking-widest uppercase">{t('onyxStrings')}</p>
              <h1 className="text-3xl font-bold text-white">{t('pageTitle')}</h1>
            </div>
          </div>
          <p className="text-gray-400 text-sm max-w-xl">
            {t('pageDescFull')}
          </p>
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <Shield className="w-3.5 h-3.5" />
            {t('ownershipNote')}
          </div>
        </motion.div>

        <div className="space-y-10">
          {/* STEP 1: Tier Selection */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <h2 className="text-lg font-bold text-white mb-1">{t('chooseStringSectionTitle')}</h2>
            <p className="text-sm text-gray-500 mb-5">{t('tierOverageNote')}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {TIERS.map((tier) => (
                <button
                  key={tier.id}
                  onClick={() => setSelectedTier(tier.id)}
                  className={`relative text-left p-5 rounded-2xl border transition-all duration-300 ${
                    selectedTier === tier.id
                      ? `${tier.activeBorder} bg-white/[0.05]`
                      : `${tier.border} bg-white/[0.02] hover:bg-white/[0.04]`
                  }`}
                >
                  {tier.recommended && (
                    <span className="absolute top-3 right-3 text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {t('recommended')}
                    </span>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selectedTier === tier.id ? 'border-amber-400 bg-amber-400' : 'border-gray-600'}`}>
                      {selectedTier === tier.id && <Check className="w-2.5 h-2.5 text-black" />}
                    </div>
                    <h3 className="font-bold text-white text-sm">{tier.name}</h3>
                  </div>
                  <p className="text-2xl font-bold text-white mb-1">US${tier.basePrice.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mb-3">{tier.players} &middot; {tier.section}</p>
                  <p className="text-xs text-gray-400 mb-3">{tier.suitable}</p>
                  <p className="text-[11px] text-gray-600">{t('overagePerMin', { amount: String(tier.overagePerMin) })}</p>
                </button>
              ))}
            </div>
          </motion.section>

          {/* STEP 2: Duration */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <h2 className="text-lg font-bold text-white mb-1">{t('trackDurationTitle')}</h2>
            <p className="text-sm text-gray-500 mb-5">
              {t('durationDesc')}
            </p>

            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center gap-6">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">{t('durationLabel')}</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setDuration((d) => Math.max(0.5, parseFloat((d - 0.5).toFixed(1))))}
                      className="w-10 h-10 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center text-lg font-bold hover:bg-white/10 transition-colors"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={duration}
                      onChange={(e) => setDuration(Math.max(0.5, parseFloat(e.target.value) || 0.5))}
                      className="w-20 text-center text-2xl font-bold bg-transparent text-white border-b border-white/20 focus:outline-none focus:border-amber-400 transition-colors pb-1"
                    />
                    <button
                      onClick={() => setDuration((d) => parseFloat((d + 0.5).toFixed(1)))}
                      className="w-10 h-10 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center text-lg font-bold hover:bg-white/10 transition-colors"
                    >
                      +
                    </button>
                    <span className="text-gray-400 text-sm">{t('minUnit')}</span>
                  </div>
                  {errors.duration && <p className="text-red-400 text-xs mt-2">{errors.duration}</p>}
                </div>

                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('totalPriceLabel')}</p>
                  <p className="text-4xl font-bold text-amber-400">US${price.toLocaleString()}</p>
                  {duration > tier.includedMinutes && (
                    <p className="text-xs text-gray-500 mt-1">
                      Includes +US${((duration - tier.includedMinutes) * tier.overagePerMin).toLocaleString()} overage
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-start gap-2 text-xs text-gray-500">
                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-500/60" />
                <p>{t('priceAdjustNote')}</p>
              </div>
            </div>
          </motion.section>

          {/* STEP 3: Project Details */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h2 className="text-lg font-bold text-white mb-5">{t('projectDetailsTitle')}</h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">{t('projectNameLabel')} <span className="text-gray-600 normal-case">(Optional)</span></label>
                <input
                  type="text"
                  placeholder="e.g. Main Theme — Dragon's Quest"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">{t('genreStyleLabel')}</label>
                  <div className="relative">
                    <select
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                      className="w-full appearance-none bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50 transition-colors text-white"
                      style={{ colorScheme: 'dark' }}
                    >
                      <option value="" className="bg-[#111]">{t('selectGenreStyle')}</option>
                      {GENRE_STYLES.map((s) => (
                        <option key={s} value={s} className="bg-[#111]">{s}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                  </div>
                  {errors.genre && <p className="text-red-400 text-xs mt-1">{errors.genre}</p>}
                </div>

                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">{t('usageTypeLabel')}</label>
                  <div className="relative">
                    <select
                      value={usageType}
                      onChange={(e) => setUsageType(e.target.value)}
                      className="w-full appearance-none bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50 transition-colors text-white"
                      style={{ colorScheme: 'dark' }}
                    >
                      <option value="" disabled className="bg-[#111]">{t('selectUsageType')}</option>
                      {USAGE_TYPES.map((u) => (
                        <option key={u} value={u} className="bg-[#111]">{u}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                  </div>
                  {errors.usageType && <p className="text-red-400 text-xs mt-1">{errors.usageType}</p>}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">{t('projectBriefLabel')}</label>
                <textarea
                  placeholder={t('projectBriefPlaceholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-amber-500/50 transition-colors resize-none"
                />
                {errors.description && <p className="text-red-400 text-xs mt-1">{errors.description}</p>}
              </div>

              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">{t('referenceLabel')}</label>
                <input
                  type="url"
                    placeholder={t('referencePlaceholder')}
                  value={referenceUrl}
                  onChange={(e) => setReferenceUrl(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
            </div>
          </motion.section>

          {/* STEP 4: Contact / Email */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
          >
            <h2 className="text-lg font-bold text-white mb-5">{t('contactTitle')}</h2>

            {isLoggedIn ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-white">{t('loggedInAs', { email: userEmail })}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t('orderLinkedToAccount')}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">{t('emailLabel')}</label>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
                  />
                  {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">{t('confirmEmailLabel')}</label>
                  <input
                    type="email"
                    placeholder={t('confirmEmailPlaceholder')}
                    value={emailConfirm}
                    onChange={(e) => setEmailConfirm(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
                  />
                  {errors.emailConfirm && <p className="text-red-400 text-xs mt-1">{errors.emailConfirm}</p>}
                </div>
              </div>
            )}
          </motion.section>

          {/* STEP 5: MIDI note */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="p-5 rounded-2xl bg-amber-950/20 border border-amber-500/20"
          >
            <div className="flex items-start gap-3">
              <Info className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-300 mb-1">{t('midiUploadTitle')}</p>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {t('midiUploadDesc')}
                </p>
              </div>
            </div>
          </motion.section>

          {/* Submit */}
          {errors.submit && (
            <p className="text-red-400 text-sm text-center">{errors.submit}</p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="pt-4 border-t border-white/[0.06]"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm text-gray-400">
                  {tier.name} &middot; {duration} min &middot; {tier.players}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-0.5">{t('totalLabel')}</p>
                <p className="text-3xl font-bold text-amber-400">US${price.toLocaleString()}</p>
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full h-14 text-base font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 transition-all duration-300 shadow-xl shadow-amber-600/25"
            >
              {submitting ? (
                <><Loader2 className="mr-2 w-5 h-5 animate-spin" /> {t('submitting')}</>
              ) : (
                <>{t('confirmProceed')} <ArrowRight className="ml-2 w-5 h-5" /></>
              )}
            </Button>
            <p className="text-center text-xs text-gray-600 mt-3">
              {t('noChargesNote')}
            </p>
            <p className="text-center text-xs text-gray-600 mt-1.5">
              {t('agreeTermsPrefix')}{' '}
              <a href="/legal/terms" target="_blank" className="text-gray-400 underline underline-offset-2 hover:text-white transition-colors">{t('termsOfService')}</a>
              {' & '}
              <a href="/legal/aup" target="_blank" className="text-gray-400 underline underline-offset-2 hover:text-white transition-colors">{t('acceptableUsePolicy')}</a>.
            </p>
          </motion.div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
