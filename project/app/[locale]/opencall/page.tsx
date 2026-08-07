import OpencallForm from '@/components/opencall/OpencallForm';
import { DEFAULT_OPENCALL_SLUG } from '@/lib/opencall-campaigns';

// 公開徵集預設入口(目前活動);其他活動走 /opencall/<slug>
export default async function OpencallPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <OpencallForm locale={locale} slug={DEFAULT_OPENCALL_SLUG} />;
}
