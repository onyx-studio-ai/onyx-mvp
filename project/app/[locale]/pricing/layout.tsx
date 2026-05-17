import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });

  return {
    title: t('pricingTitle'),
    description: t('pricingDescription'),
  };
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
