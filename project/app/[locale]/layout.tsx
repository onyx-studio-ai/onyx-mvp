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
      title: t('homeTitle'),
      description: t('homeDescription'),
      images: [{ url: '/logo-onyx.png' }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: t('homeTitle'),
      description: t('homeDescription'),
      images: [{ url: '/logo-onyx.png' }],
    },
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
    url: baseUrl,
    logo: `${baseUrl}/logo-onyx.png`,
  };
  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Onyx Studios',
    url: baseUrl,
    inLanguage: ['en', 'zh-TW', 'zh-CN'],
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
