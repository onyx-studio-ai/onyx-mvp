import { getTranslations } from 'next-intl/server';
import HeroSection from '@/components/home/HeroSection';
import VoiceTierComparison from '@/components/home/VoiceTierComparison';
import CompactPricing from '@/components/home/CompactPricing';
import { StudioGrid } from '@/components/StudioGrid';
import BrandMarquee from '@/components/home/BrandMarquee';
import FeaturedVoices from '@/components/home/FeaturedVoices';
import EnterpriseSolutions from '@/components/home/EnterpriseSolutions';
import TrustBadges from '@/components/home/TrustBadges';
import Footer from '@/components/landing/Footer';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: t('voiceTitle'),
    description: t('voiceDescription'),
    openGraph: {
      title: t('voiceTitle'),
      description: t('voiceDescription'),
      images: [{ url: '/logo-onyx.png' }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: t('voiceTitle'),
      description: t('voiceDescription'),
      images: [{ url: '/logo-onyx.png' }],
    },
  };
}

export default function VoicePage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white overflow-x-hidden pt-28">
      <HeroSection />
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
