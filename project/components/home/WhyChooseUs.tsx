'use client';

import { useTranslations } from 'next-intl';
import { Globe, Mic, Zap } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/use-scroll-animation';
import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

const FEATURE_ICONS = [Globe, Mic, Zap] as const;
const FEATURE_KEYS = ['featureGlobal', 'featureStudio', 'featureFast'] as const;

function CountUpNumber({ targetValue, suffix, isVisible }: { targetValue: number; suffix: string; isVisible: boolean }) {
  const [count, setCount] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isVisible || hasAnimated.current) return;
    hasAnimated.current = true;

    const duration = 2000;
    const steps = 60;
    const increment = targetValue / steps;
    const stepDuration = duration / steps;

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setCount(targetValue);
        clearInterval(timer);
      } else {
        setCount(Math.floor(increment * currentStep));
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [isVisible, targetValue]);

  return (
    <span className="font-light tracking-tight">
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

export default function WhyChooseUs() {
  const t = useTranslations('home.whyChooseUs');
  const stats = [
    { value: 17, suffix: t('stat1Suffix'), label: t('stat1Label') },
    { value: 7900, suffix: t('stat2Suffix'), label: t('stat2Label') },
    { value: 24, suffix: t('stat3Suffix'), label: t('stat3Label') },
  ];
  const { ref: titleRef, isVisible: titleVisible } = useScrollAnimation();
  const { ref: statsRef, isVisible: statsVisible } = useScrollAnimation();

  return (
    <section className="relative py-24 px-4 bg-[#050505]">
      <div className="max-w-7xl mx-auto">
        <div ref={titleRef} className={`text-center mb-16 fade-up-element ${titleVisible ? 'fade-up-visible' : ''}`}>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            {t('sectionTitlePrefix')}{' '}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              {t('sectionTitleBrand')}
            </span>
          </h2>
          <p className="text-gray-400 text-lg">
            {t('sectionSubtitle')}
          </p>
        </div>

        <div ref={statsRef} className="mb-20 py-12 border-y border-white/5">
          <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={statsVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="text-center"
              >
                <div className="text-5xl md:text-6xl font-light text-white mb-3">
                  <CountUpNumber targetValue={stat.value} suffix={stat.suffix} isVisible={statsVisible} />
                </div>
                <p className="text-xs font-light text-gray-500 uppercase tracking-[0.2em]">
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-12">
          {FEATURE_KEYS.map((key, index) => {
            const Icon = FEATURE_ICONS[index];
            return (
              <div key={key} className="text-center group">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 mb-6 group-hover:scale-110 transition-transform">
                  <Icon className="w-10 h-10 text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold mb-3">{t(`${key}Title`)}</h3>
                <p className="text-gray-400 leading-relaxed">
                  {t(`${key}Description`)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
