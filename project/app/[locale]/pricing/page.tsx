'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { CheckCircle2, XCircle, ArrowRight, Clock, Repeat, FileAudio, Users, Download, Shield, Mic } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import Footer from '@/components/landing/Footer';
import ContactModal from '@/components/ContactModal';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { PRICING_TIERS } from '@/lib/pricing';
import { Link } from '@/i18n/navigation';

const STAT_ICONS: Record<string, React.ReactNode> = {
  clock: <Clock className="w-5 h-5" />,
  repeat: <Repeat className="w-5 h-5" />,
  audio: <FileAudio className="w-5 h-5" />,
  users: <Users className="w-5 h-5" />,
};

type TierValue = boolean | string;

const COMPARISON_FEATURES: { category: string; features: { name: string; tier1: TierValue; tier2: TierValue; tier3: TierValue }[] }[] = [
  { category: 'compCategoryProduction', features: [
    { name: 'compPureAI', tier1: true, tier2: true, tier3: false },
    { name: 'compHumanDirector', tier1: false, tier2: true, tier3: false },
    { name: 'compMicroPatching', tier1: false, tier2: true, tier3: false },
    { name: 'compHumanRecording', tier1: false, tier2: false, tier3: true },
    { name: 'compLiveDirected', tier1: false, tier2: false, tier3: true },
    { name: 'compPronunciation', tier1: false, tier2: true, tier3: true },
  ]},
  { category: 'compCategoryDelivery', features: [
    { name: 'comp24Hour', tier1: true, tier2: false, tier3: false },
    { name: 'compPriorityQueue', tier1: false, tier2: true, tier3: false },
    { name: 'compCustomTimeline', tier1: false, tier2: false, tier3: true },
    { name: 'compRetakes', tier1: true, tier2: true, tier3: false },
    { name: 'compPickups', tier1: false, tier2: false, tier3: true },
    { name: 'compScriptUpdates', tier1: true, tier2: true, tier3: true },
  ]},
  { category: 'compCategoryDeliverables', features: [
    { name: 'compWavMp3', tier1: true, tier2: true, tier3: true },
    { name: 'compCustomFormats', tier1: false, tier2: false, tier3: true },
    { name: 'compSelfServe', tier1: true, tier2: false, tier3: false },
    { name: 'compDedicatedPM', tier1: false, tier2: false, tier3: true },
    { name: 'compMultiLang', tier1: false, tier2: false, tier3: true },
  ]},
  { category: 'compCategoryRights', features: [
    { name: 'compStandardRights', tier1: true, tier2: true, tier3: true },
    { name: 'compYouTube', tier1: true, tier2: true, tier3: true },
    { name: 'compBroadcast', tier1: '+US$99', tier2: '+US$150', tier3: true },
    { name: 'compGlobalTV', tier1: '+US$199', tier2: '+US$350', tier3: true },
  ]},
];

const FAQ_COUNT = 7;

export default function PricingPage() {
  const t = useTranslations('voice.pricing');
  const tp = useTranslations('home.pricing');
  const router = useRouter();
  const [isContactOpen, setIsContactOpen] = useState(false);

  const tierKeyMap: Record<string, string> = { 'tier-1': 'tier1', 'tier-2': 'tier2', 'tier-3': 'tier3' };

  const translatedTiers = PRICING_TIERS.map(plan => {
    const k = tierKeyMap[plan.id];
    return {
      ...plan,
      title: tp(`${k}Title`),
      tagline: tp(`${k}Tagline`),
      badge: plan.badge ? tp(`${k}Badge`) : null,
      subtitle: tp(`${k}Subtitle`),
      price: plan.id === 'tier-3' ? `${tp('tier3PricePrefix')} US$${plan.numericPrice}` : `US$${plan.numericPrice}`,
      unit: tp(`${k}Unit`),
      buttonText: tp(`${k}Button`),
      deliverables: plan.deliverables.map((d, i) => ({ ...d, name: tp(`${k}Deliverable${i + 1}`) })),
      rights: plan.rights.map((r, i) => ({ ...r, name: tp(`${k}Right${i + 1}`, { price: r.name.match(/\+\$(\d+)/)?.[1] || '' }) })),
      quickStats: plan.quickStats.map((s, i) => ({ ...s, text: tp(`${k}Stat${i + 1}`) })),
    };
  });

  const richComponents = {
    strong: (chunks: React.ReactNode) => <strong className="text-gray-300">{chunks}</strong>,
    em: (chunks: React.ReactNode) => <em className="text-gray-500">{chunks}</em>,
    contact: (chunks: React.ReactNode) => (
      <button onClick={() => setIsContactOpen(true)} className="text-blue-400 hover:text-blue-300 underline underline-offset-2 cursor-pointer">
        {chunks}
      </button>
    ),
  };

  const faqs = Array.from({ length: FAQ_COUNT }, (_, i) => ({
    question: t(`faq${i + 1}Q`),
    answer: <p>{t.rich(`faq${i + 1}A`, richComponents)}</p>,
  }));

  const handleSelectPlan = (plan: typeof PRICING_TIERS[number]) => {
    if (plan.isCustom) {
      setIsContactOpen(true);
      return;
    }
    router.push(`/voice/create?tier=${plan.id}`);
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white overflow-x-hidden pt-28">
      <ContactModal
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
        defaultMessage={tp('contactDefaultMessage')}
        department="PRODUCTION"
        source="pricing"
      />

      <section className="relative py-16 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border border-blue-500/30">
                <Mic className="w-10 h-10 text-blue-400" />
              </div>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-200 via-cyan-200 to-blue-400 bg-clip-text text-transparent">
              {t('pageTitle')}
            </h1>

            <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto">
              {t('pageSubtitle')}
            </p>
          </motion.div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-24">
            {translatedTiers.map((plan, index) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className={`relative group ${plan.highlighted ? 'lg:-mt-8' : ''}`}
              >
                {plan.badge && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                    <div className={`px-6 py-2 rounded-full text-sm font-bold text-white ${
                      plan.badgeStyle === 'gold'
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-600'
                        : 'bg-gradient-to-r from-amber-600 to-orange-600'
                    }`}>
                      {plan.badge}
                    </div>
                  </div>
                )}

                <div
                  className={`relative h-full p-8 rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border backdrop-blur-sm transition-all duration-500 ${
                    plan.highlighted
                      ? 'border-blue-500/50 shadow-2xl shadow-blue-500/20 lg:scale-105'
                      : 'border-white/10 hover:border-blue-500/30'
                  }`}
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${plan.gradient} opacity-0 group-hover:opacity-5 rounded-3xl transition-opacity duration-500`}
                  />

                  <div className="relative">
                    <h3 className="text-3xl font-bold mb-1 text-white">{plan.title}</h3>
                    <p className="text-blue-400 text-sm font-semibold mb-4">{plan.tagline}</p>

                    <div className="mb-6">
                      <span className="text-5xl font-bold text-white">{plan.price}</span>
                      {plan.unit && <span className="text-gray-500 ml-2">{plan.unit}</span>}
                    </div>

                    <p className="text-gray-400 mb-8 leading-relaxed">{plan.subtitle}</p>

                    <Button
                      onClick={() => handleSelectPlan(plan)}
                      className={`w-full h-14 text-base font-semibold mb-8 transition-all duration-300 ${
                        plan.highlighted
                          ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700'
                          : 'bg-white/10 hover:bg-white/20 border border-white/20'
                      }`}
                    >
                      {plan.buttonText}
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>

                    <div className="mb-8">
                      <div className="flex items-center gap-2 mb-4">
                        <Download className="w-5 h-5 text-blue-400" />
                        <h4 className="font-bold text-white">{t('deliverablesHeader')}</h4>
                      </div>
                      <div className="space-y-3">
                        {plan.deliverables.map((item, idx) => (
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
                        <Shield className="w-5 h-5 text-blue-400" />
                        <h4 className="font-bold text-white">{t('rightsHeader')}</h4>
                      </div>
                      <div className="space-y-3">
                        {plan.rights.map((item, idx) => (
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
                        {plan.quickStats.map((stat, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <div className="text-blue-400">{STAT_ICONS[stat.icon]}</div>
                            <span className="text-sm text-gray-400">{stat.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Detailed Comparison */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="mb-20"
          >
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">
                {t('detailedComparison')}
              </h2>
              <p className="text-xl text-gray-400">
                {t('detailedComparisonDesc')}
              </p>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                <div className="grid grid-cols-4 gap-6 px-6 mb-6">
                  <div className="col-span-1" />
                  <div className="text-center text-sm font-bold text-gray-300">{t('compColumnTier1')}</div>
                  <div className="text-center text-sm font-bold text-blue-400">{t('compColumnTier2')}</div>
                  <div className="text-center text-sm font-bold text-amber-400">{t('compColumnTier3')}</div>
                </div>
                {COMPARISON_FEATURES.map((section, sectionIdx) => (
                  <div key={sectionIdx} className="mb-8">
                    <h3 className="text-2xl font-bold text-white mb-6 px-6">{t(section.category)}</h3>
                    <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
                      {section.features.map((feature, featureIdx) => (
                        <div
                          key={featureIdx}
                          className={`grid grid-cols-4 gap-6 p-6 ${
                            featureIdx !== section.features.length - 1 ? 'border-b border-white/10' : ''
                          }`}
                        >
                          <div className="col-span-1 flex items-center">
                            <span className="text-gray-300 font-medium">{t(feature.name)}</span>
                          </div>
                          {([feature.tier1, feature.tier2, feature.tier3] as TierValue[]).map((val, idx) => (
                            <div key={idx} className="flex items-center justify-center">
                              {typeof val === 'string' ? (
                                <span className="text-sm font-semibold text-blue-400">{val}</span>
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

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center py-20 px-6 rounded-3xl bg-gradient-to-br from-blue-900/20 to-cyan-900/20 border border-blue-500/30 backdrop-blur-sm mb-20"
          >
            <h2 className="text-4xl font-bold mb-6 text-white">
              {t('notSureTitle')}
            </h2>
            <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
              {t('notSureDesc')}
            </p>
            <Link href="/contact">
              <Button className="h-14 px-10 text-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 transition-all duration-300">
                {t('contactUsButton')}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </motion.div>

          {/* FAQ */}
          <div className="max-w-3xl mx-auto mb-20">
            <h2 className="text-4xl font-bold mb-8 text-center bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">
              {t('faqTitle')}
            </h2>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`} className="border-white/10">
                  <AccordionTrigger className="text-left text-white hover:text-blue-400">
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
