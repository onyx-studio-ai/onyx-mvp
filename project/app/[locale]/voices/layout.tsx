import { getTranslations } from 'next-intl/server';
import { pageMetadata } from '@/lib/seo';

// /voices is a client component, so its metadata lives here (server).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return pageMetadata({ locale, route: '/voices', title: t('voicesTitle'), description: t('voicesDescription') });
}

export default function VoicesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
