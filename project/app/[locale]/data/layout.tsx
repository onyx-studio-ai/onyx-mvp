import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';

const BASE_URL = 'https://www.onyxstudios.ai';

// canonical + hreflang for a service route, mirroring /voice/page.tsx so Google
// can tell this page apart from the homepage instead of treating it as a dupe.
function serviceAlternates(locale: string, route: string) {
  const path = locale === routing.defaultLocale ? route : `/${locale}${route}`;
  const languages = Object.fromEntries(
    routing.locales.map((lang) => [lang, lang === routing.defaultLocale ? route : `/${lang}${route}`])
  );
  return { canonical: path, languages: { ...languages, 'x-default': route } };
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  const ogImage = { url: '/logo-og.png', width: 1200, height: 1200, alt: 'Onyx Studios Data Studio' };
  const alternates = serviceAlternates(locale, '/data');
  return {
    title: t('dataTitle'),
    description: t('dataDescription'),
    alternates,
    openGraph: {
      type: 'website' as const,
      siteName: 'Onyx Studios',
      title: t('dataTitle'),
      description: t('dataDescription'),
      url: alternates.canonical,
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
