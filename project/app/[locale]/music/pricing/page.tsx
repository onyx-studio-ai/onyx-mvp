'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useState } from 'react';
import { Music, CheckCircle2, XCircle, ArrowRight, FileAudio, Download, Shield, Clock, Repeat, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import Footer from '@/components/landing/Footer';
import ContactModal from '@/components/ContactModal';
import { MUSIC_TIERS } from '@/lib/config/pricing.config';

function buildMusicFaqs(t: ReturnType<typeof useTranslations>, onContact: () => void): { question: string; answer: React.ReactNode }[] {
  const richTags = {
    strong: (chunks: React.ReactNode) => <strong className="text-zinc-300">{chunks}</strong>,
    contact: (chunks: React.ReactNode) => (
      <button onClick={onContact} className="text-purple-400 hover:text-purple-300 underline underline-offset-2 cursor-pointer">
        {chunks}
      </button>
    ),
    em: (chunks: React.ReactNode) => <em className="text-gray-500">{chunks}</em>,
    terms: (chunks: React.ReactNode) => (
      <a href="/legal/terms" className="text-purple-400 hover:text-purple-300 underline underline-offset-2">
        {chunks}
      </a>
    ),
  };

  return [
    {
      question: t('faq1Q'),
      answer: <p>{t.rich('faq1A', richTags)}</p>,
    },
    {
      question: t('faq2Q'),
      answer: <p>{t.rich('faq2A', richTags)}</p>,
    },
    {
      question: t('faq3Q'),
      answer: (
        <div className="space-y-3">
          <p>{t('faq3AIntro')}</p>
          <p>{t.rich('faq3APart1', richTags)}</p>
          <p>{t.rich('faq3APart2', richTags)}</p>
        </div>
      ),
    },
    {
      question: t('faq4Q'),
      answer: <p>{t.rich('faq4A', richTags)}</p>,
    },
    {
      question: t('faq5Q'),
      answer: (
        <div className="space-y-3">
          <p>{t.rich('faq5APart1', richTags)}</p>
          <p>{t.rich('faq5APart2', richTags)}</p>
        </div>
      ),
    },
    {
      question: t('faq6Q'),
      answer: <p>{t.rich('faq6A', richTags)}</p>,
    },
    {
      question: t('faq7Q'),
      answer: (
        <div className="space-y-3">
          <p>{t('faq7AIntro')}</p>
          <p>{t.rich('faq7APart1', richTags)}</p>
          <p>{t.rich('faq7APart2', richTags)}</p>
          <p className="text-gray-500 text-sm italic">{t('faq7ANote')}</p>
        </div>
      ),
    },
    {
      question: t('faq8Q'),
      answer: <p>{t.rich('faq8A', richTags)}</p>,
    },
    {
      question: t('faq9Q'),
      answer: <p>{t.rich('faq9A', richTags)}</p>,
    },
    {
      question: t('faq10Q'),
      answer: <p>{t.rich('faq10A', richTags)}</p>,
    },
  ];
}

export default function MusicPricingPage() {
  const t = useTranslations('music.pricing');
  const [isContactOpen, setIsContactOpen] = useState(false);
  const faqs = buildMusicFaqs(t, () => setIsContactOpen(true));

  const configById = Object.fromEntries(MUSIC_TIERS.map(tier => [tier.id, tier]));

  const tiers = [
    {
      id: 'ai-curator',
      name: configById['ai-curator'].name,
      tagline: t('tierAiCuratorTagline'),
      price: `US$${configById['ai-curator'].price.toLocaleString()}`,
      priceDetail: t('perTrack'),
      description: t('tierAiCuratorDesc'),
      gradient: 'from-green-600 to-teal-600',
      popular: false,
      deliverables: [
        { name: t('delivFinalMixed'), included: true },
        { name: t('delivStems'), included: false },
        { name: t('delivMidi'), included: false },
        { name: t('delivInstrumental'), included: true },
      ],
      rights: [
        { name: t('rightCommercial'), included: true },
        { name: t('rightYoutube'), included: true },
        { name: t('rightBroadcast'), included: false },
        { name: t('rightFilm'), included: false },
        { name: t('rightExclusive'), included: false },
      ],
      features: [
        { icon: <Clock className="w-5 h-5" />, text: t('feat5to7Day') },
        { icon: <Repeat className="w-5 h-5" />, text: t('feat2Revisions') },
        { icon: <FileAudio className="w-5 h-5" />, text: t('featUpTo4Min') },
        { icon: <Users className="w-5 h-5" />, text: t('featAiMixing') },
      ],
    },
    {
      id: 'pro-arrangement',
      name: configById['pro-arrangement'].name,
      tagline: t('tierProArrangementTagline'),
      price: `US$${configById['pro-arrangement'].price.toLocaleString()}`,
      priceDetail: t('perTrack'),
      description: t('tierProArrangementDesc'),
      gradient: 'from-purple-600 to-pink-600',
      popular: true,
      deliverables: [
        { name: t('delivFinalMixedFlac'), included: true },
        { name: t('delivStems'), included: true },
        { name: t('delivMidi'), included: true },
        { name: t('delivInstrumentalMix'), included: true },
      ],
      rights: [
        { name: t('rightCommercial'), included: true },
        { name: t('rightYoutube'), included: true },
        { name: t('rightBroadcast'), included: true },
        { name: t('rightFilm'), included: true },
        { name: t('rightExclusive'), included: false },
      ],
      features: [
        { icon: <Clock className="w-5 h-5" />, text: t('feat10to14Day') },
        { icon: <Repeat className="w-5 h-5" />, text: t('feat3Revisions') },
        { icon: <FileAudio className="w-5 h-5" />, text: t('featUpTo4Min') },
        { icon: <Users className="w-5 h-5" />, text: t('featFullTeam') },
      ],
    },
    {
      id: 'masterpiece',
      name: configById['masterpiece'].name,
      tagline: t('tierMasterpieceTagline'),
      price: `US$${configById['masterpiece'].price.toLocaleString()}`,
      priceDetail: t('perTrack'),
      description: t('tierMasterpieceDesc'),
      gradient: 'from-orange-600 to-red-600',
      popular: false,
      deliverables: [
        { name: t('delivFinalMaster'), included: true },
        { name: t('delivStems'), included: true },
        { name: t('delivMidiProject'), included: true },
        { name: t('delivMultiLang'), included: true },
      ],
      rights: [
        { name: t('rightCommercial'), included: true },
        { name: t('rightYoutube'), included: true },
        { name: t('rightBroadcast'), included: true },
        { name: t('rightFilm'), included: true },
        { name: t('rightExclusiveBuyout'), included: true },
      ],
      features: [
        { icon: <Clock className="w-5 h-5" />, text: t('feat14to21Day') },
        { icon: <Repeat className="w-5 h-5" />, text: t('feat5Revisions') },
        { icon: <FileAudio className="w-5 h-5" />, text: t('featUpTo4Min') },
        { icon: <Users className="w-5 h-5" />, text: t('featLiveStrings') },
      ],
      revisionNote: t('masterpieceRevisionNote'),
    },
  ];

  type TierValue = boolean | string;

  const comparisonFeatures: { category: string; features: { name: string; tier1: TierValue; tier2: TierValue; tier3: TierValue }[] }[] = [
    { category: t('compCatProduction'), features: [
      { name: t('compAiBase'), tier1: true, tier2: true, tier3: true },
      { name: t('compHumanArr'), tier1: false, tier2: true, tier3: true },
      { name: t('compLiveInstrument'), tier1: false, tier2: true, tier3: true },
      { name: t('compLiveStringsBand'), tier1: false, tier2: false, tier3: true },
      { name: t('compCustomComp'), tier1: false, tier2: false, tier3: true },
    ]},
    { category: t('compCatMixing'), features: [
      { name: t('compBasicMixing'), tier1: true, tier2: true, tier3: true },
      { name: t('compAdvancedMixing'), tier1: false, tier2: true, tier3: true },
      { name: t('compProMastering'), tier1: false, tier2: true, tier3: true },
      { name: t('compDolbyAtmos'), tier1: t('contactUsBtn'), tier2: t('contactUsBtn'), tier3: t('contactUsBtn') },
    ]},
    { category: t('compCatRights'), features: [
      { name: t('compPersonalSocial'), tier1: true, tier2: true, tier3: true },
      { name: t('compCommAdv'), tier1: true, tier2: true, tier3: true },
      { name: t('compBroadcastTv'), tier1: t('contactUsBtn'), tier2: true, tier3: true },
      { name: t('compFilmCinema'), tier1: t('contactUsBtn'), tier2: true, tier3: true },
      { name: t('compFullBuyout'), tier1: false, tier2: false, tier3: true },
    ]},
  ];

  return (
    <main className="min-h-screen bg-[#050505] text-white overflow-x-hidden pt-28">
      <ContactModal
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
        defaultMessage={t('contactDefaultMessage')}
        department="PRODUCTION"
        source="music-pricing"
      />

      <section className="relative py-16 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30">
                <Music className="w-10 h-10 text-purple-400" />
              </div>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-purple-200 via-pink-200 to-purple-400 bg-clip-text text-transparent">
              {t('pageTitle')}
            </h1>

            <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto">
              {t('pageSubtitle')}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-32">
            {tiers.map((tier, index) => (
              <motion.div
                key={tier.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className={`relative group ${tier.popular ? 'lg:-mt-8' : ''}`}
              >
                {tier.popular && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-sm font-bold z-10">
                    {t('mostPopular')}
                  </div>
                )}

                <div
                  className={`relative h-full p-8 rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border backdrop-blur-sm transition-all duration-500 ${
                    tier.popular
                      ? 'border-purple-500/50 shadow-2xl shadow-purple-500/20 lg:scale-105'
                      : 'border-white/10 hover:border-purple-500/30'
                  }`}
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${tier.gradient} opacity-0 group-hover:opacity-5 rounded-3xl transition-opacity duration-500`}
                  />

                  <div className="relative">
                    <h3 className="text-3xl font-bold mb-1 text-white">{tier.name}</h3>
                    <p className="text-purple-400 text-sm font-semibold mb-4">{tier.tagline}</p>

                    <div className="mb-6">
                      <span className="text-5xl font-bold text-white">{tier.price}</span>
                      <span className="text-gray-500 ml-2">{tier.priceDetail}</span>
                    </div>

                    <p className="text-gray-400 mb-8 leading-relaxed">{tier.description}</p>

                    <Link href={`/music/create?tier=${tier.id}`}>
                      <Button
                        className={`w-full h-14 text-base font-semibold mb-8 transition-all duration-300 ${
                          tier.popular
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                            : 'bg-white/10 hover:bg-white/20 border border-white/20'
                        }`}
                      >
                        {t('startProject')}
                        <ArrowRight className="ml-2 w-5 h-5" />
                      </Button>
                    </Link>

                    <div className="mb-8">
                      <div className="flex items-center gap-2 mb-4">
                        <Download className="w-5 h-5 text-purple-400" />
                        <h4 className="font-bold text-white">{t('deliverables')}</h4>
                      </div>
                      <div className="space-y-3">
                        {tier.deliverables.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            {item.included ? (
                              <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                            ) : (
                              <XCircle className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                            )}
                            <span className={item.included ? 'text-gray-300' : 'text-gray-600'}>
                              {item.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mb-8">
                      <div className="flex items-center gap-2 mb-4">
                        <Shield className="w-5 h-5 text-purple-400" />
                        <h4 className="font-bold text-white">{t('rightsAndLicensing')}</h4>
                      </div>
                      <div className="space-y-3">
                        {tier.rights.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            {item.included ? (
                              <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                            ) : (
                              <XCircle className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                            )}
                            <span className={item.included ? 'text-gray-300' : 'text-gray-600'}>
                              {item.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-6 border-t border-white/10">
                      <div className="grid grid-cols-2 gap-4">
                        {tier.features.map((feature, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <div className="text-purple-400">{feature.icon}</div>
                            <span className="text-sm text-gray-400">{feature.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {tier.revisionNote && (
                      <div className="mt-4 px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                        <p className="text-xs text-amber-400/80 leading-relaxed">{tier.revisionNote}</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="mb-20"
          >
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                {t('detailedComparison')}
              </h2>
              <p className="text-xl text-gray-400">
                {t('detailedComparisonDesc')}
              </p>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                <div className="grid grid-cols-4 gap-6 p-6 mb-2">
                  <div className="col-span-1">
                    <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{t('compHeaderFeature')}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-semibold text-gray-300">AI Curator</span>
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-semibold text-purple-400">Pro Arrangement</span>
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-semibold text-orange-400">Masterpiece</span>
                  </div>
                </div>
                {comparisonFeatures.map((section, sectionIdx) => (
                  <div key={sectionIdx} className="mb-8">
                    <h3 className="text-2xl font-bold text-white mb-6 px-6">{section.category}</h3>
                    <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
                      {section.features.map((feature, featureIdx) => (
                        <div
                          key={featureIdx}
                          className={`grid grid-cols-4 gap-6 p-6 ${
                            featureIdx !== section.features.length - 1 ? 'border-b border-white/10' : ''
                          }`}
                        >
                          <div className="col-span-1 flex items-center">
                            <span className="text-gray-300 font-medium">{feature.name}</span>
                          </div>
                          {([feature.tier1, feature.tier2, feature.tier3] as TierValue[]).map((val, idx) => (
                            <div key={idx} className="flex items-center justify-center">
                              {typeof val === 'string' ? (
                                <button
                                  onClick={() => setIsContactOpen(true)}
                                  className="text-sm font-semibold text-purple-400 hover:text-purple-300 underline underline-offset-2 cursor-pointer transition-colors"
                                >
                                  {val}
                                </button>
                              ) : val ? (
                                <CheckCircle2 className="w-6 h-6 text-green-400" />
                              ) : (
                                <XCircle className="w-6 h-6 text-gray-700" />
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="mb-20 space-y-4"
          >
            <div className="flex items-start gap-4 p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20">
              <Shield className="w-6 h-6 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-amber-300 mb-1">{t('liveStringsAddonTitle')}</h4>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {t('liveStringsAddonFullDesc')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 rounded-2xl bg-red-500/5 border border-red-500/20">
              <Shield className="w-6 h-6 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-red-300 mb-1">{t('nonRefundableTitle')}</h4>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {t('nonRefundableFullDesc')}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center py-20 px-6 rounded-3xl bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/30 backdrop-blur-sm"
          >
            <h2 className="text-4xl font-bold mb-6 text-white">
              {t('notSureTitle')}
            </h2>
            <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
              {t('notSureDesc')}
            </p>
            <Button
              onClick={() => setIsContactOpen(true)}
              className="h-14 px-10 text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-all duration-300"
            >
              {t('contactUsBtn')}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </motion.div>

          {/* FAQ */}
          <div className="max-w-3xl mx-auto mb-20 mt-20">
            <h2 className="text-4xl font-bold mb-8 text-center bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
              {t('faqTitle')}
            </h2>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`} className="border-white/10">
                  <AccordionTrigger className="text-left text-white hover:text-purple-400">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-400">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
