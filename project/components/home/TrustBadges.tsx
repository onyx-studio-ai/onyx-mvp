'use client';

import { useTranslations } from 'next-intl';
import { ShieldCheck, HandCoins, UserCheck, FileCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const BADGE_ICONS = [ShieldCheck, HandCoins, UserCheck, FileCheck];
const BADGE_KEYS = ['badge1', 'badge2', 'badge3', 'badge4'] as const;

export default function TrustBadges() {
  const t = useTranslations('home.trustBadges');

  return (
    <section className="relative py-24 bg-gradient-to-b from-black via-gray-950/50 to-black">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            {t('sectionTitle')}
          </h2>
          <p className="text-lg text-gray-400">
            {t('sectionSubtitle')}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {BADGE_KEYS.map((key, index) => {
            const Icon = BADGE_ICONS[index];
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.12 }}
                className="flex flex-col items-center text-center px-6 py-10 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm"
              >
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-500/10 border border-slate-400/20">
                  <Icon className="h-7 w-7 text-slate-300" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {t(`${key}Title`)}
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {t(`${key}Description`)}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
