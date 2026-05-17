import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function DashboardLoading() {
  const t = useTranslations('dashboard');
  return (
    <div className="flex items-center justify-center py-24">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
        <p className="text-gray-500 text-sm">{t('loadingProjects')}</p>
      </div>
    </div>
  );
}
