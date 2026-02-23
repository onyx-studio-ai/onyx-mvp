'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Mic, CheckCircle, AlertCircle, Loader2, Zap, Star, Crown, Lock, Check, Link2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import Footer from '@/components/landing/Footer';
import { supabase } from '@/lib/supabase';
import { VOICE_TIERS, VOICE_RIGHTS_LABELS, type VoiceRightsLevel, getVoiceRightsAddonPrice } from '@/lib/config/pricing.config';
import { estimateAudioMinutes, calculatePrice } from '@/lib/estimateAudio';
import { languages, getVoicesForLanguage, findLanguageByVoiceName } from '@/lib/voices';
import ContactModal from '@/components/ContactModal';

interface ConfiguratorState {
  email: string;
  emailConfirm: string;
  baseTier: string;
  language: string;
  voiceSelection: string;
  projectName: string;
  scriptText: string;
  tone: string;
  useCase: string;
  sourceLink: string;
}

const TIER_ICONS: Record<string, any> = {
  'tier-1': Zap,
  'tier-2': Star,
  'tier-3': Crown,
};

const TONE_VALUES = ['Professional', 'Energetic', 'Soothing', 'Movie Trailer', 'Friendly'] as const;
const TONE_KEYS: Record<string, string> = {
  Professional: 'toneProfessional',
  Energetic: 'toneEnergetic',
  Soothing: 'toneSoothing',
  'Movie Trailer': 'toneMovieTrailer',
  Friendly: 'toneFriendly',
};

const USE_CASE_VALUES = ['Advertisement', 'Social Media', 'E-Learning', 'Audiobook', 'Corporate', 'Film/TV', 'Video Game', 'IVR', 'YouTube', 'Other'] as const;
const USE_CASE_KEYS: Record<string, string> = {
  Advertisement: 'useCaseAdvertisement',
  'Social Media': 'useCaseSocialMedia',
  'E-Learning': 'useCaseELearning',
  Audiobook: 'useCaseAudiobook',
  Corporate: 'useCaseCorporate',
  'Film/TV': 'useCaseFilmTV',
  'Video Game': 'useCaseVideoGame',
  IVR: 'useCaseIVR',
  YouTube: 'useCaseYouTube',
  Other: 'useCaseOther',
};

export default function VoiceConfiguratorPage() {
  const t = useTranslations('voice.create');
  const router = useRouter();
  const searchParams = useSearchParams();

  const preVoiceId = searchParams.get('voiceId') || '';
  const preVoiceName = searchParams.get('voiceName') || '';
  const preLang = searchParams.get('lang') || '';
  const preTier = searchParams.get('tier') || '';

  const [loggedInEmail, setLoggedInEmail] = useState<string | null>(null);
  const [isContactOpen, setIsContactOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setLoggedInEmail(session.user.email);
        setConfig(prev => ({ ...prev, email: session.user.email!, emailConfirm: session.user.email! }));
      }
    });
  }, []);

  const resolvedLang = useMemo(() => {
    if (preLang && preLang !== 'all' && getVoicesForLanguage(preLang).some(v => v.name === preVoiceName)) {
      return preLang;
    }
    if (preVoiceName) {
      const found = findLanguageByVoiceName(preVoiceName);
      if (found) return found;
    }
    return preLang && preLang !== 'all' ? preLang : 'en';
  }, [preLang, preVoiceName]);

  const [config, setConfig] = useState<ConfiguratorState>({
    email: '',
    emailConfirm: '',
    baseTier: preTier || '',
    language: resolvedLang,
    voiceSelection: preVoiceName || '',
    projectName: '',
    scriptText: '',
    tone: 'Professional',
    useCase: '',
    sourceLink: '',
  });

  const [errors, setErrors] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rightsLevel, setRightsLevel] = useState<VoiceRightsLevel>('standard');

  const selectedTier = VOICE_TIERS.find(t => t.id === config.baseTier);
  const isCustomTier = selectedTier?.isCustom ?? false;

  useEffect(() => {
    if (config.baseTier === 'tier-3') setRightsLevel('global');
  }, [config.baseTier]);

  const estimatedMinutes = estimateAudioMinutes(config.scriptText);
  const basePrice = config.baseTier && !isCustomTier
    ? calculatePrice(estimatedMinutes, config.baseTier as 'tier-1' | 'tier-2')
    : 0;
  const rightsAddon = config.baseTier ? getVoiceRightsAddonPrice(config.baseTier, rightsLevel) : 0;
  const totalPrice = basePrice + rightsAddon;

  const voicesForLang = useMemo(
    () => getVoicesForLanguage(config.language),
    [config.language]
  );

  useEffect(() => {
    if (preVoiceName) {
      const lang = findLanguageByVoiceName(preVoiceName);
      setConfig(prev => ({
        ...prev,
        voiceSelection: preVoiceName,
        ...(lang ? { language: lang } : {}),
      }));
    }
  }, [preVoiceName]);

  const validateConfiguration = () => {
    const newErrors: any = {};

    if (!config.email.trim()) {
      newErrors.email = t('errorEmailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.email)) {
      newErrors.email = t('errorEmailInvalid');
    }

    if (!loggedInEmail) {
      if (!config.emailConfirm.trim()) {
        newErrors.emailConfirm = t('errorEmailConfirmRequired');
      } else if (config.email.trim().toLowerCase() !== config.emailConfirm.trim().toLowerCase()) {
        newErrors.emailConfirm = t('errorEmailMismatch');
      }
    }

    if (!config.baseTier) {
      newErrors.baseTier = t('errorTierRequired');
    }

    if (!config.scriptText.trim()) {
      newErrors.scriptText = t('errorScriptRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleProceedToCheckout = async () => {
    if (!validateConfiguration()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);

    try {
      const langObj = languages.find(l => l.code === config.language);

      const response = await fetch('/api/orders/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: config.email.trim().toLowerCase(),
          language: langObj?.name || config.language,
          voice_selection: config.voiceSelection || '',
          project_name: config.projectName || '',
          script_text: config.scriptText.trim(),
          tone_style: config.tone || 'Professional',
          use_case: config.useCase || '',
          tier: config.baseTier,
          talent_id: null,
          talent_price: 0,
          duration: estimatedMinutes,
          price: totalPrice,
          source_link: config.sourceLink || '',
          broadcast_rights: rightsLevel !== 'standard',
          rights_level: rightsLevel,
          status: 'pending_payment',
          payment_status: 'pending',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create order');
      }

      router.push(`/checkout/${data.id}?type=voice`);
    } catch (error) {
      console.error('Error creating order:', error);
      setErrors({ submit: t('submitError') });
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white overflow-x-hidden pt-28 pb-20">
      <ContactModal
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
        defaultMessage={t('contactDefaultMessage')}
        department="PRODUCTION"
        source="voice-configurator"
      />

      {/* Header */}
      <section className="relative py-12 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border border-blue-500/30">
                <Mic className="w-10 h-10 text-blue-400" />
              </div>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-200 via-cyan-200 to-blue-400 bg-clip-text text-transparent">
              {t('pageTitle')}
            </h1>

            <p className="text-xl md:text-2xl text-gray-400 mb-4">
              {t('pageSubtitle')}
            </p>

            {preVoiceName && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-300 text-sm mt-2">
                <Link2 className="w-4 h-4" />
                {t('selectedVoicePrefix')} {preVoiceName}
              </div>
            )}
          </motion.div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-40">
        <div className="space-y-12">
          {/* Contact Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-sm"
          >
            <h2 className="text-3xl font-bold mb-6 text-white">{t('contactInformation')}</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-lg font-bold text-white mb-3">
                  {t('yourEmail')} <span className="text-red-500">*</span>
                </label>
                {loggedInEmail ? (
                  <div className="relative">
                    <input
                      type="email"
                      value={config.email}
                      readOnly
                      className="w-full px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-gray-400 pr-12 cursor-not-allowed"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-green-400">
                      <Lock className="w-4 h-4" />
                    </div>
                  </div>
                ) : (
                  <input
                    type="email"
                    value={config.email}
                    onChange={(e) => {
                      setConfig({ ...config, email: e.target.value });
                      setErrors({ ...errors, email: undefined });
                    }}
                    placeholder="your@email.com"
                    className={`w-full px-6 py-4 rounded-xl bg-white/5 border ${
                      errors.email ? 'border-red-500/50' : 'border-white/10'
                    } text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors`}
                  />
                )}
                {errors.email && (
                  <p className="mt-2 text-sm text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {errors.email}
                  </p>
                )}
              </div>

              {!loggedInEmail && (
                <div>
                  <label className="block text-lg font-bold text-white mb-3">
                    {t('confirmEmail')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={config.emailConfirm}
                    onChange={(e) => {
                      setConfig({ ...config, emailConfirm: e.target.value });
                      setErrors({ ...errors, emailConfirm: undefined });
                    }}
                    placeholder="Re-enter your email"
                    className={`w-full px-6 py-4 rounded-xl bg-white/5 border ${
                      errors.emailConfirm ? 'border-red-500/50' : 'border-white/10'
                    } text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors`}
                  />
                  {errors.emailConfirm && (
                    <p className="mt-2 text-sm text-red-400 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {errors.emailConfirm}
                    </p>
                  )}
                  {config.emailConfirm && config.email && config.email.toLowerCase() === config.emailConfirm.toLowerCase() && !errors.emailConfirm && (
                    <p className="mt-2 text-sm text-green-400 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      {t('emailsMatch')}
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>

          {/* Service Tier Selection */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-8 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-sm"
          >
            <h2 className="text-3xl font-bold mb-2 text-white">{t('selectServiceTierTitle')}</h2>
            <p className="text-gray-400 mb-8">{t('selectServiceTierDesc')}</p>

            {errors.baseTier && (
              <p className="mb-4 text-sm text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {errors.baseTier}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {VOICE_TIERS.map((tier) => {
                const Icon = TIER_ICONS[tier.id] || Mic;
                const isSelected = config.baseTier === tier.id;

                return (
                  <button
                    key={tier.id}
                    onClick={() => {
                      if (tier.isCustom) {
                        setIsContactOpen(true);
                        return;
                      }
                      setConfig({ ...config, baseTier: tier.id });
                      setErrors({ ...errors, baseTier: undefined });
                    }}
                    className={`relative p-6 rounded-2xl border-2 transition-all duration-300 text-left flex flex-col ${
                      isSelected
                        ? 'border-blue-500 bg-blue-600/10 shadow-lg shadow-blue-500/20 scale-[1.02]'
                        : tier.popular
                        ? 'border-yellow-500/30 bg-gradient-to-b from-yellow-950/10 to-black/40 hover:border-yellow-500/50'
                        : 'border-white/10 bg-black/40 hover:border-white/20'
                    }`}
                  >
                    {tier.badge && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                        <div className={`text-white text-[10px] font-bold px-4 py-1 rounded-full tracking-wider ${
                          tier.badge === 'MOST POPULAR'
                            ? 'bg-gradient-to-r from-yellow-600 to-amber-500 shadow-[0_0_16px_rgba(251,191,36,0.5)]'
                            : 'bg-gradient-to-r from-purple-600 to-pink-500 shadow-[0_0_16px_rgba(168,85,247,0.5)]'
                        }`}>
                          {tier.badge}
                        </div>
                      </div>
                    )}

                    <div className="mb-4 pt-1">
                      <div className={`inline-flex p-3 rounded-lg bg-gradient-to-br ${tier.gradient}`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-1">{tier.name}</h3>
                    <div className={`text-2xl font-bold mb-3 ${
                      tier.popular ? 'text-yellow-400' : 'text-blue-400'
                    }`}>
                      {tier.priceLabel || `US$${tier.price}`}
                    </div>
                    <p className="text-sm text-gray-400 mb-5 leading-relaxed">{tier.description}</p>

                    <div className="space-y-2.5 mt-auto">
                      {tier.features.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-2.5">
                          <div className={`mt-0.5 flex-shrink-0 w-4.5 h-4.5 rounded-full flex items-center justify-center ${
                            isSelected
                              ? 'bg-blue-500/30 text-blue-300'
                              : tier.popular
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-white/10 text-gray-400'
                          }`}>
                            <Check className="w-3 h-3" />
                          </div>
                          <span className="text-gray-300 text-sm leading-snug">{feature}</span>
                        </div>
                      ))}
                    </div>

                    {isSelected && (
                      <div className="absolute top-4 right-4 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                    )}

                    {tier.isCustom && (
                      <div className="mt-5 text-center text-xs text-gray-500 font-medium uppercase tracking-wider">
                        {t('contactForQuote')}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Language & Voice Selection */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="p-8 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-sm"
          >
            <h2 className="text-3xl font-bold mb-2 text-white">{t('languageAndVoiceTitle')}</h2>
            <p className="text-gray-400 mb-6">{t('languageAndVoiceDesc')}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-lg font-bold text-white mb-3">
                  {t('language')}
                </label>
                <select
                  value={config.language}
                  onChange={(e) => {
                    setConfig({ ...config, language: e.target.value, voiceSelection: '' });
                  }}
                  className="w-full px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code} className="bg-black">
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-lg font-bold text-white mb-3">
                  {t('voice')}
                </label>
                {preVoiceName && config.voiceSelection === preVoiceName ? (
                  <div className="w-full px-6 py-4 rounded-xl bg-blue-600/10 border border-blue-500/30 text-blue-200 font-medium flex items-center justify-between">
                    <span>{preVoiceName}</span>
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, voiceSelection: '' })}
                      className="text-xs text-gray-400 hover:text-white underline"
                    >
                      {t('change')}
                    </button>
                  </div>
                ) : (
                  <select
                    value={config.voiceSelection}
                    onChange={(e) => setConfig({ ...config, voiceSelection: e.target.value })}
                    className="w-full px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  >
                    <option value="" className="bg-black">{t('selectVoice')}</option>
                    {voicesForLang.map((v) => (
                      <option key={v.id} value={v.name} className="bg-black">
                        {v.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {preVoiceName && config.voiceSelection === preVoiceName && (
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-300 text-sm">
                <CheckCircle className="w-4 h-4" />
                {t('preSelected')} {preVoiceName}
              </div>
            )}
          </motion.div>

          {/* Project Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-8 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-sm"
          >
            <h2 className="text-3xl font-bold mb-6 text-white">{t('projectDetailsTitle')}</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-lg font-bold text-white mb-3">
                  {t('projectName')} <span className="text-gray-500 text-sm font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={config.projectName}
                  onChange={(e) => {
                    setConfig({ ...config, projectName: e.target.value });
                  }}
                  placeholder="(Optional) e.g., Commercial for XYZ Brand"
                  className="w-full px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-lg font-bold text-white mb-3">
                  {t('scriptContent')} <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={config.scriptText}
                  onChange={(e) => {
                    setConfig({ ...config, scriptText: e.target.value });
                    setErrors({ ...errors, scriptText: undefined });
                  }}
                  rows={8}
                  placeholder="Paste your script here..."
                  className={`w-full px-6 py-4 rounded-xl bg-white/5 border ${
                    errors.scriptText ? 'border-red-500/50' : 'border-white/10'
                  } text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors resize-none`}
                />
                {config.scriptText.trim().length >= 10 && !isCustomTier && config.baseTier && (
                  <div className="mt-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">{t('estimatedAudioLength')}</span>
                      <span className="text-white font-semibold">{estimatedMinutes} {estimatedMinutes !== 1 ? t('minutes') : t('minute')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">{t('basePrice')}</span>
                      <span className="text-white font-mono font-bold text-lg">US${basePrice.toFixed(0)}</span>
                    </div>
                    {rightsAddon > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">{t('rightsAddon')} ({VOICE_RIGHTS_LABELS[rightsLevel].name})</span>
                        <span className="text-blue-300 font-mono font-bold">+US${rightsAddon}</span>
                      </div>
                    )}
                    {rightsAddon > 0 && (
                      <div className="flex justify-between text-sm pt-2 border-t border-white/10">
                        <span className="text-gray-400 font-semibold">{t('total')}</span>
                        <span className="text-white font-mono font-bold text-lg">US${totalPrice.toFixed(0)}</span>
                      </div>
                    )}
                  </div>
                )}
                {errors.scriptText && (
                  <p className="mt-2 text-sm text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {errors.scriptText}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-lg font-bold text-white mb-3">
                    {t('targetTone')}
                  </label>
                  <select
                    value={config.tone}
                    onChange={(e) => setConfig({ ...config, tone: e.target.value })}
                    className="w-full px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  >
                    {TONE_VALUES.map((tone) => (
                      <option key={tone} value={tone} className="bg-black">
                        {t(TONE_KEYS[tone])}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-lg font-bold text-white mb-3">
                    {t('useCase')}
                  </label>
                  <select
                    value={config.useCase}
                    onChange={(e) => setConfig({ ...config, useCase: e.target.value })}
                    className="w-full px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  >
                    <option value="" className="bg-black">{t('selectUseCase')}</option>
                    {USE_CASE_VALUES.map((uc) => (
                      <option key={uc} value={uc} className="bg-black">
                        {t(USE_CASE_KEYS[uc])}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-lg font-bold text-white mb-3">
                  {t('referenceLinkOptional')}
                </label>
                <input
                  type="url"
                  value={config.sourceLink}
                  onChange={(e) => setConfig({ ...config, sourceLink: e.target.value })}
                  placeholder="https://youtube.com/... or any cloud link"
                  className="w-full px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
            </div>
          </motion.div>

          {/* Usage Rights Level */}
          {config.baseTier && !isCustomTier && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="p-8 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-sm"
            >
              <h2 className="text-3xl font-bold mb-2 text-white">{t('usageRightsTitle')}</h2>
              <p className="text-gray-400 mb-6">{t('usageRightsDesc')}</p>

              <div className="space-y-3">
                {(Object.keys(VOICE_RIGHTS_LABELS) as VoiceRightsLevel[]).map((level) => {
                  const label = VOICE_RIGHTS_LABELS[level];
                  const addonPrice = getVoiceRightsAddonPrice(config.baseTier, level);
                  const isSelected = rightsLevel === level;
                  const isIncluded = addonPrice === 0;

                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setRightsLevel(level)}
                      className={`w-full text-left p-5 rounded-2xl border transition-all duration-200 ${
                        isSelected
                          ? 'border-blue-500/60 bg-blue-500/10 ring-1 ring-blue-500/30'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                            isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-500'
                          }`}>
                            {isSelected && (
                              <div className="w-2 h-2 rounded-full bg-white" />
                            )}
                          </div>
                          <div>
                            <div className="text-white font-semibold text-lg">{label.name}</div>
                            <div className="text-gray-400 text-sm mt-0.5">{label.description}</div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          {isIncluded ? (
                            <span className="text-green-400 font-semibold text-sm">{t('included')}</span>
                          ) : (
                            <span className="text-blue-300 font-bold text-lg">+${addonPrice}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {rightsAddon > 0 && (
                <div className="mt-5 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">{t('rightsAddon')}</span>
                    <span className="text-blue-300 font-bold">+${rightsAddon}</span>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-lg border-t border-white/10 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between gap-8">
            <div className="flex-1 flex items-center gap-6">
              <div className="space-y-1">
                <div className="text-sm text-gray-400">{t('orderSummary')}</div>
                <div className="flex items-center gap-4 flex-wrap">
                  {selectedTier && (
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold">{selectedTier.name}</span>
                      <span className="text-gray-400">US${selectedTier.price}/min</span>
                    </div>
                  )}
                  {config.voiceSelection && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">•</span>
                      <span className="text-blue-300 font-medium">{config.voiceSelection}</span>
                    </div>
                  )}
                  {estimatedMinutes > 0 && selectedTier && !isCustomTier && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-300">~{estimatedMinutes} min</span>
                    </div>
                  )}
                  {rightsLevel !== 'standard' && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">•</span>
                      <span className="text-cyan-300 font-medium">{VOICE_RIGHTS_LABELS[rightsLevel].name}</span>
                      {rightsAddon > 0 && <span className="text-gray-400 text-sm">(+${rightsAddon})</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-sm text-gray-400">{t('totalPrice')}</div>
                <div className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  ${totalPrice.toLocaleString()}
                </div>
              </div>

              <button
                onClick={handleProceedToCheckout}
                disabled={!config.baseTier || isCustomTier || isSubmitting}
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold hover:from-blue-700 hover:to-cyan-700 transition-all duration-300 shadow-lg shadow-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('saving')}
                  </>
                ) : (
                  <>
                    {t('nextCheckout')}
                    <CheckCircle className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>

          {errors.submit && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="text-sm text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {errors.submit}
              </p>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </main>
  );
}
