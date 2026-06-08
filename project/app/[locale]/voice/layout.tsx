import { getTranslations } from 'next-intl/server';

const BASE_URL = 'https://www.onyxstudios.ai';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  const ogImage = { url: '/logo-og.png', width: 1200, height: 1200, alt: 'Onyx Studios Voice Studio' };
  return {
    title: t('voiceTitle'),
    description: t('voiceDescription'),
    openGraph: {
      type: 'website' as const,
      siteName: 'Onyx Studios',
      title: t('voiceTitle'),
      description: t('voiceDescription'),
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: t('voiceTitle'),
      description: t('voiceDescription'),
      images: [ogImage],
    },
  };
}

const serviceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'AI Voiceover & Text-to-Speech Studio',
  serviceType: 'AI Voiceover Production',
  description:
    'Professional AI voiceover, text-to-speech (TTS), and multilingual dubbing. Natural-sounding voice generation with consent-based voice cloning and human-directed quality assurance. 24-hour delivery.',
  provider: { '@type': 'Organization', name: 'Onyx Studios', url: BASE_URL },
  areaServed: 'Worldwide',
  url: `${BASE_URL}/voice`,
  offers: {
    '@type': 'Offer',
    priceCurrency: 'USD',
    price: '39',
    description: 'Starting from $39 per voiceover project',
  },
};

export default function VoiceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      {children}
    </>
  );
}
