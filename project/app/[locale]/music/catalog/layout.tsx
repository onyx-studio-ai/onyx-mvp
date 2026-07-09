import { getTranslations } from 'next-intl/server';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return pageMetadata({ locale, route: '/music/catalog', title: t('musicCatalogTitle'), description: t('musicCatalogDescription') });
}

export default function MusicCatalogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
