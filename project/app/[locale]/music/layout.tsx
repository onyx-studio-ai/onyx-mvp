import { getTranslations } from 'next-intl/server';

const BASE_URL = 'https://www.onyxstudios.ai';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  const ogImage = { url: '/logo-og.png', width: 1200, height: 1200, alt: 'Onyx Studios Music Studio' };
  return {
    title: t('musicTitle'),
    description: t('musicDescription'),
    openGraph: {
      type: 'website' as const,
      siteName: 'Onyx Studios',
      title: t('musicTitle'),
      description: t('musicDescription'),
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: t('musicTitle'),
      description: t('musicDescription'),
      images: [ogImage],
    },
  };
}

const serviceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'AI Music Production',
  serviceType: 'Music Production',
  description:
    'Hybrid AI music production for brands, creators, and campaigns. From direction demos to full arrangement, mixing, mastering, and ready-to-release delivery.',
  provider: { '@type': 'Organization', name: 'Onyx Studios', url: BASE_URL },
  areaServed: 'Worldwide',
  url: `${BASE_URL}/music`,
};

export default function MusicLayout({ children }: { children: React.ReactNode }) {
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
