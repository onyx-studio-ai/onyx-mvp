import { Inter, Noto_Sans_TC, Noto_Sans_SC } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import Navbar from '@/components/Navbar';
import { SelectionProvider } from '@/contexts/SelectionContext';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { notFound } from 'next/navigation';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const notoSansTC = Noto_Sans_TC({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-noto-tc' });
const notoSansSC = Noto_Sans_SC({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-noto-sc' });

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

  const fontClass = locale === 'zh-TW'
    ? `${inter.variable} ${notoSansTC.variable} font-sans`
    : locale === 'zh-CN'
      ? `${inter.variable} ${notoSansSC.variable} font-sans`
      : inter.className;

  return (
    <html lang={locale}>
      <head>
        <link rel="icon" href="/logo-onyx.png" type="image/png" />
        <script src="https://js.tappaysdk.com/sdk/tpdirect/v5.18.0" async></script>
      </head>
      <body className={fontClass}>
        <NextIntlClientProvider messages={messages}>
          <SelectionProvider>
            <Navbar />
            {children}
            <Toaster />
          </SelectionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
