import { getTranslations } from 'next-intl/server';
import { pageMetadata } from '@/lib/seo';

// /apply has sub-routes (/apply/talent, /apply/studio, …) that don't set their own
// metadata, so we give a shared title/description but NO canonical — otherwise the
// children would all inherit canonical=/apply.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return pageMetadata({ locale, route: '/apply', title: t('applyTitle'), description: t('applyDescription'), withAlternates: false });
}

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
