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
  const ogImage = { url: '/logo-og.png', width: 1200, height: 1200, alt: 'Onyx Studios Dubbing Studio' };
  const alternates = serviceAlternates(locale, '/dubbing');
  return {
    title: t('dubbingTitle'),
    description: t('dubbingDescription'),
    alternates,
    openGraph: {
      type: 'website' as const,
      siteName: 'Onyx Studios',
      title: t('dubbingTitle'),
      description: t('dubbingDescription'),
      url: alternates.canonical,
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: t('dubbingTitle'),
      description: t('dubbingDescription'),
      images: [ogImage],
    },
  };
}

const serviceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'AI Dubbing & Video Localization',
  serviceType: 'Video Dubbing & Localization',
  description:
    'Multilingual AI dubbing with original voice preservation, lip-sync alignment, and human-directed QA. For drama, series, e-learning courses, and global video distribution.',
  provider: { '@type': 'Organization', name: 'Onyx Studios', url: BASE_URL },
  areaServed: 'Worldwide',
  url: `${BASE_URL}/dubbing`,
};

export default function DubbingLayout({ children }: { children: React.ReactNode }) {
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
