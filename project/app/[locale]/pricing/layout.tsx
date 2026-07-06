import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';

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
  const ogImage = { url: '/logo-og.png', width: 1200, height: 1200, alt: 'Onyx Studios Pricing' };
  const alternates = serviceAlternates(locale, '/pricing');

  return {
    title: t('pricingTitle'),
    description: t('pricingDescription'),
    alternates,
    openGraph: {
      type: 'website' as const,
      siteName: 'Onyx Studios',
      title: t('pricingTitle'),
      description: t('pricingDescription'),
      url: alternates.canonical,
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: t('pricingTitle'),
      description: t('pricingDescription'),
      images: [ogImage],
    },
  };
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
