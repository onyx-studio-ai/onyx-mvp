'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { supabase } from '@/lib/supabase';
import {
  DollarSign,
  Users,
  Download,
  Star,
  ArrowRight,
  Upload,
  FileCheck,
  Mic2,
  Package,
  MessageCircle,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Footer from '@/components/landing/Footer';
import ABSlider from '@/components/orchestra/ABSlider';
import { ORCHESTRA_TIERS } from '@/lib/config/pricing.config';

const TIER_DISPLAY = {
  tier1: { gradient: 'from-slate-600 to-slate-500', borderColor: 'border-white/10' },
  tier2: { gradient: 'from-sky-700 to-sky-600', borderColor: 'border-sky-500/20' },
  tier3: { gradient: 'from-amber-600 to-amber-500', borderColor: 'border-amber-500/40' },
  tier4: { gradient: 'from-red-700 to-rose-600', borderColor: 'border-red-500/20' },
} as const;

export default function OrchestraPage() {
  const t = useTranslations('orchestra.landing');
  const [rawSrc, setRawSrc] = useState('/audio/sample-raw.mp3');
  const [liveSrc, setLiveSrc] = useState('/audio/sample-human.mp3');

  useEffect(() => {
    supabase
      .from('audio_showcases')
      .select('slot_key, audio_url')
      .eq('section', 'orchestra_comparison')
      .then(({ data }) => {
        if (data) {
          data.forEach((row) => {
            if (row.audio_url) {
              if (row.slot_key === 'raw') setRawSrc(row.audio_url);
              if (row.slot_key === 'live') setLiveSrc(row.audio_url);
            }
          });
        }
      });
  }, []);

  const coreAdvantages = [
    {
      icon: DollarSign,
      title: t('coreAdv1Title'),
      description: t('coreAdv1Desc'),
      gradient: 'from-amber-500 to-yellow-400',
      glow: 'shadow-amber-500/20',
    },
    {
      icon: Users,
      title: t('coreAdv2Title'),
      description: t('coreAdv2Desc'),
      gradient: 'from-sky-500 to-blue-400',
      glow: 'shadow-sky-500/20',
    },
    {
      icon: Download,
      title: t('coreAdv3Title'),
      description: t('coreAdv3Desc'),
      gradient: 'from-emerald-500 to-teal-400',
      glow: 'shadow-emerald-500/20',
    },
  ];

  const pricingTiers = ORCHESTRA_TIERS.map((tier, idx) => {
    const ui = TIER_DISPLAY[tier.id as keyof typeof TIER_DISPLAY];
    const n = idx + 1;
    return {
      ...tier,
      name: t(`tierName${n}` as Parameters<typeof t>[0]),
      section: t(`tierSection${n}` as Parameters<typeof t>[0]),
      suitable: t(`tierSuitable${n}` as Parameters<typeof t>[0]),
      price: `US$${tier.basePrice.toLocaleString()}`,
      players: `${tier.players} ${t('playersUnit')}`,
      overage: `+US$${tier.overagePerMin} ${t('extraMinUnit')}`,
      gradient: ui?.gradient ?? '',
      borderColor: ui?.borderColor ?? 'border-white/10',
    };
  });

  const soloInstruments = [
    {
      category: t('soloWesternStrings'),
      instruments: [t('instrViolin'), t('instrViola'), t('instrCello'), t('instrDoubleBass')],
      accent: 'border-sky-500/30',
      dot: 'bg-sky-400',
    },
    {
      category: t('soloChinese'),
      instruments: [t('instrErhu'), t('instrGuzheng'), t('instrPipa'), t('instrDizi'), t('instrSuona'), t('instrYangqin')],
      accent: 'border-rose-500/30',
      dot: 'bg-rose-400',
    },
    {
      category: t('soloWoodwinds'),
      instruments: [t('instrFlute'), t('instrOboe'), t('instrClarinet'), t('instrBassoon')],
      accent: 'border-emerald-500/30',
      dot: 'bg-emerald-400',
    },
    {
      category: t('soloBrass'),
      instruments: [t('instrTrumpet'), t('instrFrenchHorn'), t('instrTrombone'), t('instrTuba')],
      accent: 'border-amber-500/30',
      dot: 'bg-amber-400',
    },
  ];

  const workflowSteps = [
    {
      number: '01',
      icon: Upload,
      title: t('workflow1Title'),
      description: t('workflow1Desc'),
      warning: false,
      color: 'from-sky-600 to-sky-500',
    },
    {
      number: '02',
      icon: FileCheck,
      title: t('workflow2Title'),
      description: t('workflow2Desc'),
      warning: true,
      color: 'from-amber-600 to-amber-500',
    },
    {
      number: '03',
      icon: Mic2,
      title: t('workflow3Title'),
      description: t('workflow3Desc'),
      warning: false,
      color: 'from-rose-600 to-pink-500',
    },
    {
      number: '04',
      icon: Package,
      title: t('workflow4Title'),
      description: t('workflow4Desc'),
      warning: false,
      color: 'from-emerald-600 to-teal-500',
    },
  ];

  return (
    <main className="min-h-screen bg-[#050505] text-white overflow-x-hidden pt-24">

      {/* HERO SECTION */}
      <section className="relative min-h-[80vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-24 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-amber-600/6 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-sky-600/6 rounded-full blur-[100px]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.015)_0%,transparent_70%)]" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold tracking-[0.15em] uppercase mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            {t('heroBadge')}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold text-white leading-[1.08] tracking-tight mb-6"
          >
            {t('heroTitle1')}
            <br />
            <span className="bg-gradient-to-r from-amber-400 via-orange-300 to-yellow-400 bg-clip-text text-transparent">
              {t('heroTitle2')}
            </span>
            <br />
            <span className="text-gray-300 text-4xl md:text-5xl font-semibold">
              {t('heroTitle3')}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.22 }}
            className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed mb-10"
          >
            {t('heroDesc')}{' '}
            <span className="text-gray-200 font-medium">
              {t('heroDescHighlight')}
            </span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
          >
            <Link href="#pricing">
              <Button className="h-14 px-10 text-base font-semibold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 transition-all duration-300 shadow-xl shadow-amber-600/25">
                {t('viewFlatRatePricing')}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* A/B COMPARISON SECTION */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-y-0 left-0 right-0 bg-gradient-to-b from-transparent via-emerald-950/10 to-transparent" />
        </div>

        <div className="max-w-4xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-emerald-400 mb-4">
              {t('interactiveProof')}
            </p>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              {t('hearDifferenceTitle')}
              <br />
              <span className="text-red-400">{t('abAi')}</span>
              <span className="text-gray-500 mx-3 font-light">{t('abVs')}</span>
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                {t('abHumanTouch')}
              </span>
            </h2>
            <p className="text-gray-500 text-base max-w-xl mx-auto">
              {t('abSliderDesc')}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            viewport={{ once: true }}
          >
            <ABSlider rawSrc={rawSrc} liveSrc={liveSrc} />
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true }}
            className="text-center text-xs text-gray-700 mt-6"
          >
            {t('abFootnote')}
          </motion.p>
        </div>
      </section>

      {/* SECTION 3: THREE CORE ADVANTAGES */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-gradient-to-b from-sky-900/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-sky-400 mb-4">
              {t('whyChooseOnyxLabel')}
            </p>
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-5">
              {t('threeUnbeatable')}
              <br />
              <span className="bg-gradient-to-r from-sky-400 to-teal-400 bg-clip-text text-transparent">
                {t('coreAdvantages')}
              </span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              {t('advantagesSubtitle')}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {coreAdvantages.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.15 }}
                viewport={{ once: true }}
                className="group relative"
              >
                <div
                  className={`relative p-8 rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 hover:border-white/20 transition-all duration-500 h-full shadow-xl ${item.glow}`}
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-5 rounded-3xl transition-opacity duration-500`}
                  />
                  <div className="relative">
                    <div
                      className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${item.gradient} mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}
                    >
                      <item.icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4">{item.title}</h3>
                    <p className="text-gray-300 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4: PRICING TIERS */}
      <section id="pricing" className="relative py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-amber-400 mb-4">
              {t('flatRatePricingLabel')}
            </p>
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-5">
              {t('chooseYour')}
              <br />
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                {t('stringSection')}
              </span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              {t('pricingSubtitle')}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-12">
            {pricingTiers.map((tier, index) => (
              <motion.div
                key={tier.id}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className={`relative group ${tier.recommended ? 'xl:-mt-6' : ''}`}
              >
                {tier.recommended && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-xs font-bold text-white shadow-lg shadow-amber-500/30">
                      <Star className="w-3.5 h-3.5 fill-white" />
                      {t('bestValueRecommended')}
                    </div>
                  </div>
                )}

                <div
                  className={`relative h-full flex flex-col p-7 rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border backdrop-blur-sm transition-all duration-500 group-hover:shadow-xl ${tier.borderColor} ${
                    tier.recommended
                      ? 'shadow-2xl shadow-amber-500/10 border-amber-500/40'
                      : 'hover:border-white/20'
                  }`}
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${tier.gradient} opacity-0 group-hover:opacity-5 rounded-3xl transition-opacity duration-500`}
                  />
                  <div className="relative flex flex-col flex-1">
                    <div className={`inline-flex self-start px-3 py-1 rounded-full bg-gradient-to-r ${tier.gradient} bg-opacity-20 mb-5`}>
                      <span className="text-xs font-bold text-white tracking-wider uppercase">
                        {tier.players}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-1">{tier.name}</h3>
                    <p className="text-xs text-gray-500 mb-5 font-mono">{tier.section}</p>

                    <div className="mb-5">
                      <span className="text-5xl font-bold text-white">{tier.price}</span>
                      <span className="text-gray-500 text-sm ml-2">{t('usdPerTrack')}</span>
                    </div>

                    <p className="text-gray-400 text-sm leading-relaxed mb-6 flex-1">
                      {tier.suitable}
                    </p>

                    <div className="pt-4 border-t border-white/5">
                      <p className="text-xs text-gray-600">
                        {t('overageLabel')}{' '}
                        <span className="text-gray-400 font-semibold">{tier.overage}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <Link href="/music/orchestra/order">
              <Button className="h-14 px-10 text-base font-semibold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 transition-all duration-300 shadow-lg shadow-amber-600/20">
                {t('startYourStringsProject')}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* SECTION 5: PRICING TERMS */}
      <section className="relative py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="p-8 rounded-2xl bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/10 backdrop-blur-sm"
          >
            <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
              <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-amber-400 to-orange-500" />
              {t('pricingTermsTitle')}
            </h3>

            <div className="space-y-4 text-sm text-gray-400 leading-relaxed">
              <p>
                <span className="text-gray-200 font-semibold">{t('standardTrackLabel')}</span>{' '}
                {t.rich('standardTrackDesc', {
                  strong: (chunks) => <span className="text-white font-semibold">{chunks}</span>,
                })}
              </p>

              <div>
                <p className="text-gray-200 font-semibold mb-3">
                  {t('extendedTracksLabel')}{' '}
                  <span className="text-gray-400 font-normal">
                    {t('extendedTracksDesc')}
                  </span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {ORCHESTRA_TIERS.map(tier => ({
                    players: `${tier.players} ${t('playersUnit')}`,
                    rate: `+US$${tier.overagePerMin} ${t('extraMinUnit')}`,
                  })).map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-white/5 border border-white/[0.08] text-center"
                    >
                      <p className="text-gray-300 font-semibold text-xs mb-1">{item.players}</p>
                      <p className="text-amber-400 font-bold text-sm">{item.rate}</p>
                    </div>
                  ))}
                </div>
              </div>

              <p>
                <span className="text-gray-200 font-semibold">{t('suitesLabel')}</span>{' '}
                {t('suitesOver10')}{' '}
                <Link href="/contact" className="text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors">
                  {t('suitesContactLink')}
                </Link>
              </p>

              <div className="mt-6 pt-6 border-t border-white/10">
                <p>
                  <span className="text-gray-200 font-semibold">{t('recordingOwnershipLabel')}</span>{' '}
                  {t.rich('recordingOwnershipDesc', {
                    strong: (chunks) => <span className="text-white font-semibold">{chunks}</span>,
                  })}
                </p>
                <p className="mt-3 text-xs text-gray-600">
                  {t('recordingOwnershipNote')}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 6: SOLOISTS & EASTERN MASTERY */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-rose-900/5 to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl border border-rose-500/20 bg-gradient-to-br from-rose-950/30 via-[#0a0505] to-slate-950/30 backdrop-blur-sm p-12 md:p-16"
          >
            <div className="absolute top-0 right-0 w-80 h-80 bg-rose-600/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-600/8 rounded-full blur-[80px] pointer-events-none" />

            <div className="relative z-10">
              <div className="max-w-3xl mb-10">
                <p className="text-sm font-semibold tracking-[0.2em] uppercase text-rose-400 mb-4">
                  {t('soloistsSectionLabel')}
                </p>
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">
                  {t('soloistsSectionTitle1')}
                  <br />
                  <span className="bg-gradient-to-r from-rose-400 to-amber-400 bg-clip-text text-transparent">
                    {t('soloistsSectionTitle2')}
                  </span>
                </h2>
                <p className="text-gray-400 text-lg leading-relaxed">
                  {t.rich('soloistsSectionDesc', {
                    strong: (chunks) => <span className="text-white font-medium">{chunks}</span>,
                  })}
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                {soloInstruments.map((group, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: idx * 0.1 }}
                    viewport={{ once: true }}
                    className={`p-5 rounded-2xl bg-white/5 border ${group.accent} hover:bg-white/8 transition-all duration-300`}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <span className={`w-2 h-2 rounded-full ${group.dot} flex-shrink-0`} />
                      <h4 className="text-sm font-bold text-white tracking-wide">{group.category}</h4>
                    </div>
                    <div className="space-y-1.5">
                      {group.instruments.map((inst, iIdx) => (
                        <div key={iIdx} className="text-gray-400 text-sm pl-4">
                          {inst}
                        </div>
                      ))}
                    </div>
                    <p className="text-gray-600 text-xs mt-3 pl-4 italic">{t('moreOnRequest')}</p>
                  </motion.div>
                ))}
              </div>

              <Link href="/contact">
                <Button className="h-14 px-8 text-base font-semibold bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 transition-all duration-300 shadow-lg shadow-rose-600/20">
                  <MessageCircle className="mr-2 w-5 h-5" />
                  {t('contactForSoloQuote')}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 7: HOW IT WORKS */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-sm font-semibold tracking-[0.2em] uppercase text-teal-400 mb-4">
              {t('howItWorksLabel')}
            </p>
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-5">
              {t('howItWorksTitle1')}
              <br />
              <span className="bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
                {t('howItWorksTitle2')}
              </span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              {t('howItWorksSubtitle')}
            </p>
          </motion.div>

          <div className="relative">
            <div className="hidden lg:block absolute top-16 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {workflowSteps.map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.12 }}
                  viewport={{ once: true }}
                  className="group relative"
                >
                  <div className="relative p-7 rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 hover:border-white/20 transition-all duration-500 h-full">
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${step.color} opacity-0 group-hover:opacity-5 rounded-3xl transition-opacity duration-500`}
                    />
                    <div className="relative">
                      <div className="flex items-center gap-3 mb-5">
                        <div
                          className={`flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br ${step.color} shadow-lg group-hover:scale-110 transition-transform duration-300`}
                        >
                          <step.icon className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-4xl font-bold text-white/[0.08] select-none">
                          {step.number}
                        </span>
                      </div>

                      <div className="mb-4 flex items-start gap-2">
                        <h3 className="text-lg font-bold text-white">{step.title}</h3>
                        {step.warning && (
                          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        )}
                      </div>

                      <p className="text-gray-300 text-sm leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            viewport={{ once: true }}
            className="mt-16 text-center"
          >
            <div className="inline-flex flex-col sm:flex-row gap-4 items-center">
              <Link href="/music/orchestra/order">
                <Button className="h-14 px-10 text-base font-semibold bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 transition-all duration-300 shadow-lg shadow-teal-600/20">
                  <Upload className="mr-2 w-5 h-5" />
                  {t('startYourProject')}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link href="/contact">
                <Button className="h-14 px-10 text-base font-semibold bg-white/[0.08] hover:bg-white/15 border border-white/15 transition-all duration-300">
                  <MessageCircle className="mr-2 w-5 h-5" />
                  {t('talkToProducer')}
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
