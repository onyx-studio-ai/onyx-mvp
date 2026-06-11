import { Toaster } from '@/components/ui/sonner';
import Navbar from '@/components/Navbar';
import { SelectionProvider } from '@/contexts/SelectionContext';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });

  return {
    metadataBase: new URL('https://www.onyxstudios.ai'),
    title: t('homeTitle'),
    description: t('homeDescription'),
    openGraph: {
      type: 'website',
      siteName: 'Onyx Studios',
      title: t('homeTitle'),
      description: t('homeDescription'),
      // opengraph-image.tsx at this route segment auto-generates 1200×630
    },
    twitter: {
      card: 'summary_large_image' as const,
      site: '@onyxstudios',
      title: t('homeTitle'),
      description: t('homeDescription'),
    },
    icons: {
      icon: [
        { url: '/favicon.svg', type: 'image/svg+xml' },
        { url: '/favicon-32.png', type: 'image/png', sizes: '32x32' },
        { url: '/favicon-192.png', type: 'image/png', sizes: '192x192' },
      ],
      apple: { url: '/apple-touch-icon.png', sizes: '180x180' },
    },
    ...(process.env.NEXT_PUBLIC_GSC_VERIFICATION && {
      verification: { google: process.env.NEXT_PUBLIC_GSC_VERIFICATION },
    }),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();
  const baseUrl = 'https://www.onyxstudios.ai';
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Onyx Studios',
    legalName: 'Fine Entertainment Co., Ltd.',
    url: baseUrl,
    logo: `${baseUrl}/logo-og.png`,
    image: `${baseUrl}/logo-og.png`,
    description: 'AI-powered voiceover, dubbing, music production, and speech data studio. Founded 2008 in Taiwan. All AI output is human-directed and fully licensed.',
    foundingDate: '2008',
    slogan: 'AI-Generated. Human-Perfected.',
    email: 'support@onyxstudios.ai',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '2F., No. 79, Anping Rd., Zhonghe Dist.',
      addressLocality: 'New Taipei City',
      addressCountry: 'TW',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'support@onyxstudios.ai',
      availableLanguage: ['English', 'Chinese'],
    },
    areaServed: 'Worldwide',
    knowsAbout: ['AI Voiceover', 'Text-to-Speech', 'AI Dubbing', 'Music Production', 'Speech Data Collection', 'Voice Cloning'],
  };
  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Onyx Studios',
    url: baseUrl,
    inLanguage: ['en', 'zh-TW', 'zh-CN'],
    potentialAction: {
      '@type': 'SearchAction',
      target: `${baseUrl}/voices?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  const fontClass = 'font-sans';

  return (
    <div className={fontClass}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <NextIntlClientProvider messages={messages}>
        <SelectionProvider>
          <Navbar />
          {children}
          <Toaster />
        </SelectionProvider>
      </NextIntlClientProvider>
    </div>
  );
}
