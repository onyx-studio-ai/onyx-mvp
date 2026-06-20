import { getTranslations, getLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import HeroSection from '@/components/home/HeroSection';
import VoiceTierComparison from '@/components/home/VoiceTierComparison';
import CompactPricing from '@/components/home/CompactPricing';
import { StudioGrid } from '@/components/StudioGrid';
import BrandMarquee from '@/components/home/BrandMarquee';
import FeaturedVoices from '@/components/home/FeaturedVoices';
import EnterpriseSolutions from '@/components/home/EnterpriseSolutions';
import TrustBadges from '@/components/home/TrustBadges';
import Footer from '@/components/landing/Footer';
import { routing } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  const canonicalPath = locale === routing.defaultLocale ? '/voice' : `/${locale}/voice`;
  const languageAlternates = Object.fromEntries(
    routing.locales.map((lang) => [
      lang,
      lang === routing.defaultLocale ? '/voice' : `/${lang}/voice`,
    ])
  );

  return {
    title: t('voiceTitle'),
    description: t('voiceDescription'),
    alternates: {
      canonical: canonicalPath,
      languages: {
        ...languageAlternates,
        'x-default': '/voice',
      },
    },
    openGraph: {
      title: t('voiceTitle'),
      description: t('voiceDescription'),
      url: canonicalPath,
      images: [{ url: '/logo-og.png' }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: t('voiceTitle'),
      description: t('voiceDescription'),
      images: [{ url: '/logo-og.png' }],
    },
  };
}

export default function VoicePage() {
  return <VoicePageContent />;
}

async function VoicePageContent() {
  const t = await getTranslations('voice.landing');
  const locale = await getLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);
  const serviceJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: 'AI Voiceover and Text-to-Speech Production',
    name: 'Onyx AI Voiceover Studio',
    provider: {
      '@type': 'Organization',
      name: 'Onyx Studios',
      url: 'https://www.onyxstudios.ai',
    },
    areaServed: 'Worldwide',
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white overflow-x-hidden pt-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <HeroSection
        badgeText={t('studioBadge')}
        badgeTone="blue"
        sectionPaddingClassName="pt-20 pb-16"
        contentClassName="-mt-10 md:-mt-14"
      />

      <section className="px-4 sm:px-6 lg:px-8 pb-10">
        <div className="max-w-6xl mx-auto rounded-2xl bg-white/[0.03] border border-white/[0.08] p-6 md:p-8">
          <p className="text-xs md:text-sm uppercase tracking-[0.18em] text-blue-300 mb-3">
            {t('clarityLabel')}
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            {t('clarityTitle')}
          </h2>
          <p className="text-gray-300 leading-relaxed mb-4">
            {t('clarityDesc')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-3 text-gray-200">
              {t('clarityPoint1')}
            </div>
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-3 text-gray-200">
              {t('clarityPoint2')}
            </div>
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-3 text-gray-200">
              {t('clarityPoint3')}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 pb-10">
        <div className="max-w-6xl mx-auto rounded-2xl bg-white/[0.03] border border-white/[0.08] p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div>
            <p className="text-xs md:text-sm uppercase tracking-[0.18em] text-teal-300 mb-2">
              {tx('真人配音', '真人配音', 'Human voice talent')}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
              {tx('想要真人配音員?', '想要真人配音员?', 'Prefer a real human voice?')}
            </h2>
            <p className="text-gray-300 leading-relaxed max-w-2xl">
              {tx(
                '1,500+ 配音員、30+ 語種。瀏覽試聽後直接發案,由我們居中為您協調報價與排程。',
                '1,500+ 配音员、30+ 语种。浏览试听后直接发案,由我们居中为您协调报价与排程。',
                '1,500+ voice actors across 30+ languages. Browse and listen, then post a brief — we coordinate quotes and scheduling for you.'
              )}
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Link href="/talents" className="inline-flex items-center justify-center rounded-lg bg-teal-400 text-black font-medium px-5 py-3 text-sm hover:bg-teal-300 transition-colors">
              {tx('瀏覽人才庫', '浏览人才库', 'Browse talent')}
            </Link>
            <Link href="/hire" className="inline-flex items-center justify-center rounded-lg border border-white/15 text-white px-5 py-3 text-sm hover:bg-white/5 transition-colors">
              {tx('發案', '发案', 'Post a brief')}
            </Link>
          </div>
        </div>
      </section>

      <VoiceTierComparison />
      <CompactPricing />
      <TrustBadges />
      <FeaturedVoices />
      <BrandMarquee />
      <StudioGrid />
      <EnterpriseSolutions />
      <Footer />
    </main>
  );
}
