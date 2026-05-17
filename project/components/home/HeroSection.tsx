'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
import { Link } from '@/i18n/navigation';

type HeroSectionProps = {
  badgeText?: string;
  badgeTone?: 'neutral' | 'blue';
  sectionPaddingClassName?: string;
  contentClassName?: string;
};

export default function HeroSection({
  badgeText,
  badgeTone = 'neutral',
  sectionPaddingClassName = 'py-20',
  contentClassName = '',
}: HeroSectionProps) {
  const t = useTranslations('home.hero');
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const isBlueTone = badgeTone === 'blue';

  return (
    <section
      className={`relative min-h-[calc(100vh-6rem)] flex items-center justify-center px-4 overflow-hidden ${sectionPaddingClassName}`}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-[#0a0a0a] to-[#050505]" />

      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className={`relative z-10 max-w-7xl mx-auto w-full text-center ${contentClassName}`}
      >
        <div className="mb-8 inline-block">
          <div
            className={`flex items-center gap-3 px-6 py-2 backdrop-blur-sm border rounded-full ${
              isBlueTone ? 'bg-blue-500/[0.08] border-blue-300/25' : 'bg-white/5 border-white/10'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${isBlueTone ? 'bg-blue-300' : 'bg-blue-500'} animate-pulse`} />
            <span className={`text-sm font-medium tracking-wide ${isBlueTone ? 'text-gray-100' : 'text-gray-300'}`}>
              {badgeText ?? t('badge')}
            </span>
          </div>
        </div>

        <h1 className={`text-6xl ${isEnglish ? 'md:text-7xl' : 'md:text-8xl'} font-bold mb-8 tracking-tight ${isEnglish ? '' : 'md:whitespace-nowrap'}`}>
          {isEnglish ? (
            <>
              <span className="block bg-gradient-to-r from-white via-gray-300 to-gray-500 bg-clip-text text-transparent">
                {t('headingLine1')}
              </span>
              <span className="block bg-gradient-to-r from-white via-gray-300 to-gray-500 bg-clip-text text-transparent">
                {t('headingLine2')}
              </span>
            </>
          ) : (
            <span className="bg-gradient-to-r from-white via-gray-300 to-gray-500 bg-clip-text text-transparent">
              {t('headingLine1')} {t('headingLine2')}
            </span>
          )}
        </h1>

        <p className="text-xl md:text-2xl text-gray-400 mb-8 max-w-3xl mx-auto leading-relaxed">
          {t('description', { years: '17' })}
        </p>

        <p className="text-sm text-gray-400 font-medium mb-4 tracking-wide">
          {t('subtext', { price: 'US$49' })}
        </p>

        <Link href="/voices">
          <Button
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-7 text-lg rounded-full shadow-[0_0_50px_rgba(59,130,246,0.3)] hover:shadow-[0_0_70px_rgba(59,130,246,0.5)] transition-all duration-300 group"
          >
            <Play className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
            {t('buttonBrowseVoices')}
          </Button>
        </Link>
      </motion.div>
    </section>
  );
}
