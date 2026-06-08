import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  const ogImage = { url: '/logo-og.png', width: 1200, height: 1200, alt: 'Onyx Studios FAQ' };
  return {
    title: t('faqTitle'),
    description: t('faqDescription'),
    alternates: {
      canonical: '/faq',
      languages: {
        'en': '/faq',
        'zh-TW': '/zh-TW/faq',
        'zh-CN': '/zh-CN/faq',
      },
    },
    openGraph: {
      type: 'website' as const,
      siteName: 'Onyx Studios',
      title: t('faqTitle'),
      description: t('faqDescription'),
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: t('faqTitle'),
      description: t('faqDescription'),
      images: [ogImage],
    },
  };
}

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return children;
}
