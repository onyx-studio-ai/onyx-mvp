import { getTranslations } from 'next-intl/server';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return pageMetadata({ locale, route: '/music/orchestra', title: t('musicOrchestraTitle'), description: t('musicOrchestraDescription') });
}

export default function MusicOrchestraLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
