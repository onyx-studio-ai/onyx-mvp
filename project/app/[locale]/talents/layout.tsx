import { getTranslations } from 'next-intl/server';
import { pageMetadata } from '@/lib/seo';

// Wraps the /talents roster list. /talents/[id] has its own layout metadata which
// overrides this canonical, so the list page's canonical here is safe.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return pageMetadata({ locale, route: '/talents', title: t('talentsTitle'), description: t('talentsDescription') });
}

export default function TalentsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
