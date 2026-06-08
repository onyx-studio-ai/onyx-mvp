import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
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
  };
}

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return children;
}
