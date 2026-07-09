import { getTranslations } from 'next-intl/server';
import { pageMetadata } from '@/lib/seo';

// /hire is a client component, so its metadata lives here (server).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return pageMetadata({ locale, route: '/hire', title: t('hireTitle'), description: t('hireDescription') });
}

export default function HireLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
