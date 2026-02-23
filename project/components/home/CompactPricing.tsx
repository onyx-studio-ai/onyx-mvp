'use client';

import { Zap, Star, Crown, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { PRICING_TIERS } from '@/lib/pricing';
import { useTranslations } from 'next-intl';

const TIER_ICONS: Record<string, React.ReactNode> = {
  'tier-1': <Zap className="w-6 h-6" />,
  'tier-2': <Star className="w-6 h-6" />,
  'tier-3': <Crown className="w-6 h-6" />,
};

export default function CompactPricing() {
  const t = useTranslations('home.pricing');

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
    };
  });

  return (
    <section className="relative py-24 px-4 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-[#0a0a0a] to-[#050505]" />

      <div className="relative z-10 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            {t('sectionTitle')}
            <span className="bg-gradient-to-r from-blue-200 via-cyan-200 to-blue-400 bg-clip-text text-transparent">
              {' '}{t('sectionTitleHighlight')}
            </span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            {t('sectionSubtitle')}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {translatedTiers.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="relative group"
            >
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <div className={`px-5 py-1.5 rounded-full text-xs font-bold text-white ${
                    plan.badgeStyle === 'gold'
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600'
                      : 'bg-gradient-to-r from-amber-600 to-orange-600'
                  }`}>
                    {plan.badge}
                  </div>
                </div>
              )}

              <div className={`relative h-full p-7 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border backdrop-blur-sm transition-all duration-300 ${
                plan.highlighted
                  ? 'border-blue-500/50 shadow-lg shadow-blue-500/10'
                  : 'border-white/10 hover:border-white/20'
              }`}>
                <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${plan.gradient} mb-4`}>
                  {TIER_ICONS[plan.id]}
                </div>

                <h3 className="text-2xl font-bold text-white mb-1">{plan.title}</h3>
                <p className="text-blue-400 text-sm font-medium mb-4">{plan.tagline}</p>

                <div className="mb-4">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  {plan.unit && <span className="text-gray-500 text-sm ml-1.5">{plan.unit}</span>}
                </div>

                <p className="text-gray-400 text-sm mb-6 leading-relaxed">{plan.subtitle}</p>

                <Link
                  href={plan.isCustom ? '/contact' : `/voice/create?tier=${plan.id}`}
                  className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all duration-300 ${
                    plan.highlighted
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white'
                      : 'bg-white/10 hover:bg-white/15 border border-white/20 text-white'
                  }`}
                >
                  {plan.buttonText}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
