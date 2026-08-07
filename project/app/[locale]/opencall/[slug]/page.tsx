import OpencallForm from '@/components/opencall/OpencallForm';

// 各檔公開徵集:/opencall/<slug>(活動設定在 lib/opencall-campaigns.ts)
export default async function OpencallSlugPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  return <OpencallForm locale={locale} slug={slug} />;
}
