import { getTranslations } from 'next-intl/server';

const BASE_URL = 'https://www.onyxstudios.ai';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  const ogImage = { url: '/logo-og.png', width: 1200, height: 1200, alt: 'Onyx Studios Data Studio' };
  return {
    title: t('dataTitle'),
    description: t('dataDescription'),
    openGraph: {
      type: 'website' as const,
      siteName: 'Onyx Studios',
      title: t('dataTitle'),
      description: t('dataDescription'),
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: t('dataTitle'),
      description: t('dataDescription'),
      images: [ogImage],
    },
  };
}

const serviceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Speech Data Collection & Annotation',
  serviceType: 'AI Speech Data Services',
  description:
    'Enterprise speech data collection, cleanup, segmentation, and annotation for TTS and ASR training pipelines. Managed talent operations and turnkey delivery.',
  provider: { '@type': 'Organization', name: 'Onyx Studios', url: BASE_URL },
  areaServed: 'Worldwide',
  url: `${BASE_URL}/data`,
};

export default function DataLayout({ children }: { children: React.ReactNode }) {
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
