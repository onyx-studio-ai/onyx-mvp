 'use client';

import { Loader2, CheckCircle2, AlertCircle, Clock, Eye, Package, Search, Download, CreditCard } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('dashboard');

  switch (status) {
    case 'pending_payment':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <CreditCard className="w-3 h-3" />
          {t('statusAwaitingPayment')}
        </span>
      );
    case 'paid':
    case 'pending':
    case 'in_queue':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
          <Clock className="w-3 h-3" />
          {t('inQueue')}
        </span>
      );
    case 'awaiting_files':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <Package className="w-3 h-3" />
          {t('awaitingFiles')}
        </span>
      );
    case 'under_review':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <Search className="w-3 h-3" />
          {t('statusUnderReview')}
        </span>
      );
    case 'processing':
    case 'in_production':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
          <Loader2 className="w-3 h-3 animate-spin" />
          {t('statusInProduction')}
        </span>
      );
    case 'delivered':
    case 'version_ready':
    case 'demo_ready':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
          <Eye className="w-3 h-3" />
          {t('statusReadyForReview')}
        </span>
      );
    case 'awaiting_final':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          <Package className="w-3 h-3" />
          {t('finalizing')}
        </span>
      );
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
          <CheckCircle2 className="w-3 h-3" />
          {t('completed')}
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
          <AlertCircle className="w-3 h-3" />
          {t('statusFailed')}
        </span>
      );
    default:
      return null;
  }
}
