'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Music, Sparkles, CheckCircle, AlertCircle, Loader2, Music2, Users, Crown, Star, Award, X, Lock } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import Footer from '@/components/landing/Footer';
import { supabase } from '@/lib/supabase';
import {
  MUSIC_TIERS,
  MUSIC_STRING_ADDONS,
  VOCALIST_FLAT_PRICE,
  calculateMusicTotal,
  getMusicTier,
  getMusicStringAddon
} from '@/lib/config/pricing.config';

interface Talent {
  id: string;
  name: string;
  type: string;
  gender: string;
  languages: string[];
  tags: string[];
  bio: string;
  headshot_url: string;
  demo_urls: any[];
  internal_cost: number;
  is_active: boolean;
}

interface ConfiguratorState {
  email: string;
  emailConfirm: string;
  baseTier: string;
  stringTier: string;
  addVocalist: boolean;
  selectedTalent: Talent | null;
  projectName: string;
  genreTags: string[];
  customGenre: string;
  sonicRefUrl: string;
  usageType: string;
  description: string;
}

const POPULAR_GENRES = [
  'Cinematic Orchestral',
  'Upbeat Pop',
  'Dark Ambient',
  'Epic Trailer',
  'Chill Lo-Fi',
  'Corporate Uplifting',
  'Electronic Dance',
  'Acoustic Folk',
  'Hip Hop Beat',
  'Jazz Fusion'
];

// Map icons to tiers
const TIER_ICONS: Record<string, any> = {
  'ai-curator': Sparkles,
  'pro-arrangement': Music2,
  'masterpiece': Crown,
};

const STRING_ICONS: Record<string, any> = {
  'intimate-ensemble': Music,
  'rich-studio-strings': Users,
  'cinematic-symphony': Award,
};

export default function MusicConfiguratorPage() {
  const t = useTranslations('music.create');
  const router = useRouter();
  const searchParams = useSearchParams();
  const preTier = searchParams.get('tier') || '';
  const [loggedInEmail, setLoggedInEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setLoggedInEmail(session.user.email);
        setConfig(prev => ({ ...prev, email: session.user.email!, emailConfirm: session.user.email! }));
      }
    });
  }, []);

  const [config, setConfig] = useState<ConfiguratorState>({
    email: '',
    emailConfirm: '',
    baseTier: preTier,
    stringTier: '',
    addVocalist: false,
    selectedTalent: null,
    projectName: '',
    genreTags: [],
    customGenre: '',
    sonicRefUrl: '',
    usageType: '',
    description: '',
  });

  const [talents, setTalents] = useState<Talent[]>([]);
  const [loadingTalents, setLoadingTalents] = useState(false);
  const [vocalistLang, setVocalistLang] = useState('');
  const [errors, setErrors] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate total price using centralized function
  const calculateTotal = () => {
    return calculateMusicTotal({
      baseTierId: config.baseTier,
      stringAddonId: config.stringTier,
      talentPrice: config.selectedTalent ? VOCALIST_FLAT_PRICE : 0,
    });
  };

  useEffect(() => {
    if (config.addVocalist && talents.length === 0) {
      loadTalents();
    }
  }, [config.addVocalist, talents.length]);

  const loadTalents = async () => {
    setLoadingTalents(true);
    try {
      const response = await fetch('/api/talents?type=singer');
      if (!response.ok) throw new Error('Failed to fetch talents');
      const data = await response.json();
      setTalents(data || []);
    } catch (error) {
      console.error('Error loading talents:', error);
    } finally {
      setLoadingTalents(false);
    }
  };

  const toggleGenreTag = (genre: string) => {
    if (config.genreTags.includes(genre)) {
      setConfig({
        ...config,
        genreTags: config.genreTags.filter(g => g !== genre)
      });
    } else {
      setConfig({
        ...config,
        genreTags: [...config.genreTags, genre]
      });
    }
    setErrors({ ...errors, genreTags: undefined });
  };

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

    if (config.genreTags.length === 0 && !config.customGenre.trim()) {
      newErrors.genreTags = t('errorGenreRequired');
    }

    if (!config.sonicRefUrl.trim()) {
      newErrors.sonicRefUrl = t('errorSonicRefRequired');
    } else if (
      !config.sonicRefUrl.startsWith('http://') &&
      !config.sonicRefUrl.startsWith('https://')
    ) {
      newErrors.sonicRefUrl = t('errorSonicRefInvalid');
    }

    if (!config.description.trim()) {
      newErrors.description = t('errorDescriptionRequired');
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
      const totalAmount = calculateTotal();
      const genreDescription = config.customGenre.trim()
        ? config.customGenre
        : config.genreTags.join(', ');

      const response = await fetch('/api/orders/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: config.email.trim().toLowerCase(),
          project_name: config.projectName.trim(),
          vibe: genreDescription,
          reference_link: config.sonicRefUrl.trim(),
          usage_type: config.usageType?.trim() || null,
          description: config.description?.trim() || '',
          tier: config.baseTier,
          talent_id: config.selectedTalent?.id || null,
          talent_price: config.selectedTalent ? VOCALIST_FLAT_PRICE : 0,
          string_addon: config.stringTier?.trim() || null,
          price: totalAmount,
          status: 'pending_payment',
          payment_status: 'pending',
          order_number: null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create order');
      }

      router.push(`/checkout/${data.id}?type=music`);
    } catch (error) {
      console.error('Error creating order:', error);
      setErrors({ submit: t('submitError') });
      setIsSubmitting(false);
    }
  };

  const totalPrice = calculateTotal();
  const selectedBaseTier = getMusicTier(config.baseTier || '');
  const selectedStringTier = getMusicStringAddon(config.stringTier || '');

  return (
    <main className="min-h-screen bg-[#050505] text-white overflow-x-hidden pt-28 pb-20">
      {/* Header */}
      <section className="relative py-12 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30">
                <Music className="w-10 h-10 text-purple-400" />
              </div>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-purple-200 via-pink-200 to-purple-400 bg-clip-text text-transparent">
              {t('pageTitle')}
            </h1>

            <p className="text-xl md:text-2xl text-gray-400 mb-4">
              {t('pageSubtitle')}
            </p>
          </motion.div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-40">
        <div className="space-y-12">
            {/* Email Input */}
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
                      } text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors`}
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
                      } text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors`}
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

            {/* Base Tier Selection */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-8 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-sm"
            >
              <h2 className="text-3xl font-bold mb-2 text-white">{t('selectBaseTierTitle')}</h2>
              <p className="text-gray-400 mb-6">{t('selectBaseTierDesc')}</p>

              {errors.baseTier && (
                <p className="mb-4 text-sm text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {errors.baseTier}
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {MUSIC_TIERS.map((tier) => {
                  const Icon = TIER_ICONS[tier.id] || Music;
                  const isSelected = config.baseTier === tier.id;

                  return (
                    <button
                      key={tier.id}
                      onClick={() => {
                        setConfig({ ...config, baseTier: tier.id });
                        setErrors({ ...errors, baseTier: undefined });
                      }}
                      className={`relative p-6 rounded-2xl border transition-all duration-300 text-left ${
                        isSelected
                          ? 'bg-purple-600/20 border-purple-500 shadow-lg shadow-purple-500/20 scale-105'
                          : 'bg-black/40 border-white/10 hover:border-purple-500/50 hover:scale-102'
                      }`}
                    >
                      {tier.popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-xs font-bold">
                          MOST POPULAR
                        </div>
                      )}

                      <div className="mb-4">
                        <div className={`inline-flex p-3 rounded-lg bg-gradient-to-br ${tier.gradient}`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                      </div>

                      <h3 className="text-xl font-bold text-white mb-2">{tier.name}</h3>
                      <div className="text-3xl font-bold text-purple-400 mb-3">
                        ${tier.price.toLocaleString()}
                      </div>
                      <p className="text-sm text-gray-400 mb-4">{tier.description}</p>

                      <ul className="space-y-2">
                        {tier.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      {isSelected && (
                        <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* String Recording Add-ons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-8 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-sm"
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">{t('liveStringsTitle')}</h2>
                  <p className="text-gray-400">{t('liveStringsDesc')}</p>
                </div>
                {config.stringTier && (
                  <button
                    onClick={() => setConfig({ ...config, stringTier: '' })}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {t('clearSelection')}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {MUSIC_STRING_ADDONS.map((tier) => {
                  const Icon = STRING_ICONS[tier.id] || Music;
                  const isSelected = config.stringTier === tier.id;

                  return (
                    <button
                      key={tier.id}
                      onClick={() => setConfig({ ...config, stringTier: tier.id })}
                      className={`relative p-6 rounded-2xl border transition-all duration-300 text-left ${
                        isSelected
                          ? 'bg-amber-600/20 border-amber-500 shadow-lg shadow-amber-500/20 scale-105'
                          : 'bg-black/40 border-white/10 hover:border-amber-500/50 hover:scale-102'
                      }`}
                    >
                      {tier.popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-600 to-orange-600 text-xs font-bold">
                          RECOMMENDED
                        </div>
                      )}

                      <div className="mb-4">
                        <Icon className="w-8 h-8 text-amber-400" />
                      </div>

                      <h3 className="text-xl font-bold text-white mb-1">{tier.name}</h3>
                      <div className="text-sm text-amber-400 font-semibold mb-3">
                        {tier.players} {t('professionalPlayers')}
                      </div>
                      <div className="text-2xl font-bold text-amber-400 mb-3">
                        +${tier.price.toLocaleString()}
                      </div>
                      <p className="text-sm text-gray-400">{tier.description}</p>

                      {isSelected && (
                        <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* Vocalist Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-8 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">{t('vocalistTitle')}</h2>
                  <p className="text-gray-400">{t('vocalistDesc')} (+${VOCALIST_FLAT_PRICE})</p>
                </div>
                <button
                  onClick={() => setConfig({ ...config, addVocalist: !config.addVocalist, selectedTalent: null })}
                  className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 ${
                    config.addVocalist
                      ? 'bg-pink-600 text-white'
                      : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                  }`}
                >
                  {config.addVocalist ? t('removeVocalist') : t('addVocalist')}
                </button>
              </div>

              {config.addVocalist && (
                <div className="mt-4">
                  {loadingTalents ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                    </div>
                  ) : talents.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      {t('noVocalists')}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-lg font-bold text-white mb-3">{t('languageLabel')}</label>
                          <select
                            value={vocalistLang}
                            onChange={(e) => {
                              setVocalistLang(e.target.value);
                              setConfig({ ...config, selectedTalent: null });
                            }}
                            className="w-full px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-pink-500/50 transition-colors"
                          >
                            <option value="" className="bg-black">{t('selectLanguage')}</option>
                            {Array.from(new Set(talents.flatMap((t) => t.languages || []))).sort().map((lang) => (
                              <option key={lang} value={lang} className="bg-black">{lang}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-lg font-bold text-white mb-3">{t('vocalistLabel')}</label>
                          <select
                            value={config.selectedTalent?.id || ''}
                            onChange={(e) => {
                              const t = talents.find((t) => t.id === e.target.value) || null;
                              setConfig({ ...config, selectedTalent: t });
                            }}
                            disabled={!vocalistLang}
                            className="w-full px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-pink-500/50 transition-colors disabled:opacity-40"
                          >
                            <option value="" className="bg-black">{vocalistLang ? t('chooseVocalist') : t('selectLanguageFirst')}</option>
                            {talents
                              .filter((t) => t.languages?.includes(vocalistLang))
                              .map((t) => (
                                <option key={t.id} value={t.id} className="bg-black">{t.name}</option>
                              ))}
                          </select>
                        </div>
                      </div>

                      {config.selectedTalent && (
                        <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-pink-600/10 border border-pink-500/20">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white">{config.selectedTalent.name}</p>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {config.selectedTalent.languages?.map((lang, idx) => (
                                <span key={idx} className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                  {lang}
                                </span>
                              ))}
                              {config.selectedTalent.tags?.slice(0, 4).map((tag, idx) => (
                                <span key={idx} className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                          <span className="text-lg font-bold text-pink-400 flex-shrink-0">+${VOCALIST_FLAT_PRICE}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </motion.div>

            {/* Project Details */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="p-8 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-sm"
            >
              <h2 className="text-3xl font-bold mb-6 text-white">{t('projectDetailsTitle')}</h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-lg font-bold text-white mb-3">
                    {t('projectName')} <span className="text-gray-500 text-sm font-normal">({t('optional')})</span>
                  </label>
                  <input
                    type="text"
                    value={config.projectName}
                    onChange={(e) => {
                      setConfig({ ...config, projectName: e.target.value });
                    }}
                    placeholder="(Optional) e.g., Brand Campaign Q3 2026, Short Film OST"
                    className="w-full px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-lg font-bold text-white mb-3">
                    {t('musicStyle')} <span className="text-red-500">*</span>
                  </label>
                  <p className="text-sm text-gray-400 mb-4">
                    {t('musicStyleDesc')}
                  </p>

                  {errors.genreTags && (
                    <p className="mb-4 text-sm text-red-400 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {errors.genreTags}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-3 mb-4">
                    {POPULAR_GENRES.map((genre) => (
                      <button
                        key={genre}
                        onClick={() => toggleGenreTag(genre)}
                        className={`px-4 py-2 rounded-lg border transition-all duration-200 ${
                          config.genreTags.includes(genre)
                            ? 'bg-purple-600 border-purple-500 text-white'
                            : 'bg-white/5 border-white/10 text-gray-300 hover:border-purple-500/50'
                        }`}
                      >
                        {genre}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">
                      {t('customStyleDesc')}
                    </label>
                    <input
                      type="text"
                      value={config.customGenre}
                      onChange={(e) => {
                        setConfig({ ...config, customGenre: e.target.value });
                        setErrors({ ...errors, genreTags: undefined });
                      }}
                      placeholder="e.g., Experimental electronic with tribal percussion"
                      className="w-full px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-lg font-bold text-white mb-3">
                    {t('sonicRefUrl')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    value={config.sonicRefUrl}
                    onChange={(e) => {
                      setConfig({ ...config, sonicRefUrl: e.target.value });
                      setErrors({ ...errors, sonicRefUrl: undefined });
                    }}
                    placeholder="https://youtube.com/... or any cloud link"
                    className={`w-full px-6 py-4 rounded-xl bg-white/5 border ${
                      errors.sonicRefUrl ? 'border-red-500/50' : 'border-white/10'
                    } text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors`}
                  />
                  {errors.sonicRefUrl && (
                    <p className="mt-2 text-sm text-red-400 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {errors.sonicRefUrl}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-lg font-bold text-white mb-3">
                    {t('usageType')}
                  </label>
                  <select
                    value={config.usageType}
                    onChange={(e) => setConfig({ ...config, usageType: e.target.value })}
                    className="w-full px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                  >
                    <option value="" className="bg-black">{t('selectUsageType')}</option>
                    <option value="Commercial Advertisement" className="bg-black">{t('usageCommercial')}</option>
                    <option value="Social Media Content" className="bg-black">{t('usageSocialMedia')}</option>
                    <option value="Film/TV Production" className="bg-black">{t('usageFilmTV')}</option>
                    <option value="Video Game" className="bg-black">{t('usageVideoGame')}</option>
                    <option value="Podcast/Radio" className="bg-black">{t('usagePodcastRadio')}</option>
                    <option value="Corporate Video" className="bg-black">{t('usageCorporate')}</option>
                    <option value="YouTube Content" className="bg-black">{t('usageYouTube')}</option>
                    <option value="Live Event" className="bg-black">{t('usageLiveEvent')}</option>
                    <option value="Other" className="bg-black">{t('usageOther')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-lg font-bold text-white mb-3">
                    {t('projectDescription')} <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={config.description}
                    onChange={(e) => {
                      setConfig({ ...config, description: e.target.value });
                      setErrors({ ...errors, description: undefined });
                    }}
                    rows={6}
                    placeholder="Describe your project, mood, target audience, and any specific requirements..."
                    className={`w-full px-6 py-4 rounded-xl bg-white/5 border ${
                      errors.description ? 'border-red-500/50' : 'border-white/10'
                    } text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors resize-none`}
                  />
                  {errors.description && (
                    <p className="mt-2 text-sm text-red-400 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {errors.description}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
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
                  {selectedBaseTier && (
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold">{selectedBaseTier.name}</span>
                      <span className="text-gray-400">US${selectedBaseTier.price.toLocaleString()}</span>
                    </div>
                  )}
                  {selectedStringTier && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">+</span>
                      <span className="text-white font-semibold">{selectedStringTier.name}</span>
                      <span className="text-amber-400">US${selectedStringTier.price.toLocaleString()}</span>
                    </div>
                  )}
                  {config.selectedTalent && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">+</span>
                      <span className="text-white font-semibold">{config.selectedTalent.name}</span>
                      <span className="text-pink-400">US${VOCALIST_FLAT_PRICE}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-sm text-gray-400">{t('totalPrice')}</div>
                <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  ${totalPrice.toLocaleString()}
                </div>
              </div>

              <button
                onClick={handleProceedToCheckout}
                disabled={!config.baseTier || isSubmitting}
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold hover:from-purple-700 hover:to-pink-700 transition-all duration-300 shadow-lg shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
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

          <div className="mt-3">
            <p className="text-[11px] text-gray-600 leading-relaxed">
              {t('legalDisclaimer')}
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
