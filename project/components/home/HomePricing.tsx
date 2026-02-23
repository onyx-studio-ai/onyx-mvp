'use client';

import { useState } from 'react';
import { Zap, Star, Crown, CheckCircle2, XCircle, ArrowRight, Clock, Repeat, FileAudio, Users, Download, Shield, Wand2, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import PaymentCheckout from '@/components/PaymentCheckout';
import ContactModal from '@/components/ContactModal';
import { toast } from 'sonner';
import { useSelection } from '@/contexts/SelectionContext';
import { PRICING_TIERS } from '@/lib/pricing';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

const TIER_ICONS: Record<string, React.ReactNode> = {
  'tier-1': <Zap className="w-8 h-8" />,
  'tier-2': <Star className="w-8 h-8" />,
  'tier-3': <Crown className="w-8 h-8" />,
};

const STAT_ICONS: Record<string, React.ReactNode> = {
  clock: <Clock className="w-5 h-5" />,
  repeat: <Repeat className="w-5 h-5" />,
  audio: <FileAudio className="w-5 h-5" />,
  users: <Users className="w-5 h-5" />,
};

const COMPARISON_FEATURES = [
  { category: 'categoryProduction', features: [
    { name: 'featurePureAI', tier1: true, tier2: true, tier3: false },
    { name: 'featureHumanDirector', tier1: false, tier2: true, tier3: false },
    { name: 'featureMicroPatching', tier1: false, tier2: true, tier3: false },
    { name: 'featureHumanRecording', tier1: false, tier2: false, tier3: true },
    { name: 'featureLiveDirected', tier1: false, tier2: false, tier3: true },
    { name: 'featurePronunciation', tier1: false, tier2: true, tier3: true },
  ]},
  { category: 'categoryDelivery', features: [
    { name: 'feature24Hour', tier1: true, tier2: false, tier3: false },
    { name: 'featurePriorityQueue', tier1: false, tier2: true, tier3: false },
    { name: 'featureCustomTimeline', tier1: false, tier2: false, tier3: true },
    { name: 'featureRetakes', tier1: true, tier2: true, tier3: false },
    { name: 'featurePickups', tier1: false, tier2: false, tier3: true },
    { name: 'featureScriptUpdates', tier1: true, tier2: true, tier3: true },
  ]},
  { category: 'categoryDeliverables', features: [
    { name: 'featureWavMp3', tier1: true, tier2: true, tier3: false },
    { name: 'featureCustomFormats', tier1: false, tier2: false, tier3: true },
    { name: 'featureSelfServe', tier1: true, tier2: false, tier3: false },
    { name: 'featureDedicatedPM', tier1: false, tier2: false, tier3: true },
    { name: 'featureMultiLang', tier1: false, tier2: false, tier3: true },
  ]},
  { category: 'categoryRights', features: [
    { name: 'featureStandardRights', tier1: true, tier2: true, tier3: true },
    { name: 'featureYouTube', tier1: true, tier2: true, tier3: true },
    { name: 'featureBroadcast', tier1: false, tier2: false, tier3: true },
    { name: 'featureGlobalTV', tier1: false, tier2: false, tier3: true },
  ]},
];

export default function HomePricing() {
  const t = useTranslations('home.pricing');
  const { selectedVoiceId, selectedVoiceName } = useSelection();

  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState({ name: '', price: 0 });
  const [isContactOpen, setIsContactOpen] = useState(false);

  const tierKeyMap: Record<string, string> = { 'tier-1': 'tier1', 'tier-2': 'tier2', 'tier-3': 'tier3' };

  const translatedTiers = PRICING_TIERS.map(plan => {
    const k = tierKeyMap[plan.id];
    return {
      ...plan,
      title: t(`${k}Title`),
      tagline: t(`${k}Tagline`),
      badge: plan.badge ? t(`${k}Badge`) : null,
      subtitle: t(`${k}Subtitle`),
      price: plan.id === 'tier-3' ? `${t('tier3PricePrefix')} US$${plan.numericPrice}` : `US$${plan.numericPrice}`,
      unit: t(`${k}Unit`),
      buttonText: t(`${k}Button`),
      features: plan.features.map((_, i) => t(`${k}Feature${i + 1}`)),
      deliverables: plan.deliverables.map((d, i) => ({ ...d, name: t(`${k}Deliverable${i + 1}`) })),
      rights: plan.rights.map((r, i) => ({ ...r, name: t(`${k}Right${i + 1}`, { price: r.name.match(/\+\$(\d+)/)?.[1] || '' }) })),
      quickStats: plan.quickStats.map((s, i) => ({ ...s, text: t(`${k}Stat${i + 1}`) })),
    };
  });

  const handleOrderClick = (planName: string, numericPrice: number) => {
    setSelectedPlan({ name: planName, price: numericPrice });
    setShowCheckout(true);
  };

  const handleContactClick = () => {
    setIsContactOpen(true);
  };

  const handlePaymentSuccess = (prime: string, projectData: any) => {
    const orderNumber = `ORD-${Date.now().toString().slice(-8)}`;

    toast.success(t('toastOrderReceived'), {
      description: t('toastOrderDescription', { orderNumber }),
      duration: 4000,
    });

    setShowCheckout(false);
  };

  return (
    <>
      <PaymentCheckout
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        amount={selectedPlan.price}
        planName={selectedPlan.name}
        onPaymentSuccess={handlePaymentSuccess}
        selectedVoiceId={selectedVoiceId || undefined}
        selectedVoiceName={selectedVoiceName || undefined}
      />

      <ContactModal
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
        defaultMessage={t('contactDefaultMessage')}
        department="PRODUCTION"
        source="home-pricing"
      />

      <section className="relative py-32 px-4 overflow-hidden" id="pricing">
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-[#0a0a0a] to-[#050505]" />

        <div className="relative z-10 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
              {t('sectionTitle')}
              <span className="bg-gradient-to-r from-blue-200 via-cyan-200 to-blue-400 bg-clip-text text-transparent">
                {' '}{t('sectionTitleHighlight')}
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              {t('sectionSubtitle')}
            </p>

            {selectedVoiceId && selectedVoiceName && (
              <div className="mt-8 mx-auto max-w-2xl">
                <div className="relative rounded-2xl border border-blue-500/50 bg-gradient-to-r from-blue-600/10 to-cyan-600/10 backdrop-blur-sm p-4 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                  <div className="flex items-center justify-center gap-3">
                    <Wand2 className="w-5 h-5 text-blue-400 animate-pulse" />
                    <p className="text-white font-semibold">
                      {t('selectedVoiceLabel')} <span className="text-blue-300">{selectedVoiceName}</span>
                    </p>
                    <Sparkles className="w-5 h-5 text-blue-400" />
                  </div>
                  <p className="text-gray-400 text-sm mt-2">
                    {t('choosePlanBelow')}
                  </p>
                </div>
              </div>
            )}
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
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
                    <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${plan.gradient} mb-4`}>
                      {TIER_ICONS[plan.id]}
                    </div>

                    <h3 className="text-3xl font-bold mb-1 text-white">{plan.title}</h3>
                    <p className="text-blue-400 text-sm font-semibold mb-4">{plan.tagline}</p>

                    <div className="mb-6">
                      <span className="text-5xl font-bold text-white">{plan.price}</span>
                      {plan.unit && <span className="text-gray-500 ml-2">{plan.unit}</span>}
                    </div>

                    <p className="text-gray-400 mb-8 leading-relaxed">{plan.subtitle}</p>

                    <Button
                      onClick={() => plan.isCustom ? handleContactClick() : handleOrderClick(plan.title, plan.numericPrice)}
                      className={`w-full h-14 text-base font-semibold mb-8 transition-all duration-300 ${
                        plan.highlighted
                          ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700'
                          : 'bg-white/10 hover:bg-white/20 border border-white/20'
                      }`}
                    >
                      {plan.buttonText}
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>

                    {/* Deliverables */}
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

                    {/* Rights & Licensing */}
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

                    {/* Quick Stats */}
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
            className="mt-32 mb-20"
          >
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">
                {t('detailedComparisonTitle')}
              </h2>
              <p className="text-xl text-gray-400">
                {t('detailedComparisonSubtitle')}
              </p>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                <div className="grid grid-cols-4 gap-6 px-6 py-4 mb-2">
                  <div className="col-span-1" />
                  <div className="text-center text-sm font-bold text-blue-300 tracking-wide">{t('columnTier1')}</div>
                  <div className="text-center text-sm font-bold text-blue-300 tracking-wide">{t('columnTier2')}</div>
                  <div className="text-center text-sm font-bold text-blue-300 tracking-wide">{t('columnTier3')}</div>
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
                          <div className="flex items-center justify-center">
                            {feature.tier1 ? (
                              <CheckCircle2 className="w-6 h-6 text-green-400" />
                            ) : (
                              <XCircle className="w-6 h-6 text-gray-700" />
                            )}
                          </div>
                          <div className="flex items-center justify-center">
                            {feature.tier2 ? (
                              <CheckCircle2 className="w-6 h-6 text-green-400" />
                            ) : (
                              <XCircle className="w-6 h-6 text-gray-700" />
                            )}
                          </div>
                          <div className="flex items-center justify-center">
                            {feature.tier3 ? (
                              <CheckCircle2 className="w-6 h-6 text-green-400" />
                            ) : (
                              <XCircle className="w-6 h-6 text-gray-700" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center py-20 px-6 rounded-3xl bg-gradient-to-br from-blue-900/20 to-cyan-900/20 border border-blue-500/30 backdrop-blur-sm"
          >
            <h2 className="text-4xl font-bold mb-6 text-white">
              {t('ctaTitle')}
            </h2>
            <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
              {t('ctaSubtitle')}
            </p>
            <Link href="/contact">
              <Button className="h-14 px-10 text-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 transition-all duration-300">
                {t('ctaButton')}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  );
}
