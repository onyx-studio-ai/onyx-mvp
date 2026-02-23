'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { supabase, Order } from '@/lib/supabase';
import { useDashboardUser } from '@/contexts/DashboardContext';
import { getMusicTierLabel } from '@/lib/config/pricing.config';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/dashboard/StatusBadge';
import {
  Download,
  Loader2,
  Clock,
  CheckCircle2,
  Mic2,
  FileAudio,
  Activity,
  Music,
  Music2,
  ArrowRight,
  Award,
  ShieldCheck,
  ExternalLink,
  CreditCard,
} from 'lucide-react';
import AdminUpload from '@/components/admin/AdminUpload';
import { Link } from '@/i18n/navigation';

const ADMIN_EMAIL = 'admin@onyxstudios.ai';

function useRelativeTime() {
  const t = useTranslations('dashboard');
  return (dateStr: string): string => {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('timeJustNow');
    if (mins < 60) return t('timeMinAgo', { n: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('timeHourAgo', { n: hours });
    const days = Math.floor(hours / 24);
    if (days < 7) return t('timeDayAgo', { n: days });
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return t('timeWeekAgo', { n: weeks });
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
}

const VOICE_STEPS = ['pending_payment', 'paid', 'in_production', 'delivered', 'awaiting_final', 'completed'];
const MUSIC_STEPS = ['pending_payment', 'paid', 'in_production', 'demo_ready', 'version_ready', 'awaiting_final', 'completed'];
const ORCH_STEPS = ['awaiting_files', 'under_review', 'in_production', 'completed'];

function getStepInfo(status: string, steps: string[]): { current: number; total: number } {
  const idx = steps.findIndex(s => s === status);
  return { current: idx === -1 ? 0 : idx, total: steps.length - 1 };
}

function useNextAction() {
  const t = useTranslations('dashboard');
  const actionKeys: Record<string, string> = {
    pending_payment: 'nextPendingPayment',
    paid: 'nextPaid',
    in_queue: 'nextPaid',
    in_production: 'nextInProduction',
    delivered: 'nextDelivered',
    demo_ready: 'nextDemoReady',
    version_ready: 'nextVersionReady',
    client_reviewing: 'nextClientReviewing',
    awaiting_final: 'nextAwaitingFinal',
    awaiting_files: 'nextAwaitingFiles',
    under_review: 'nextUnderReview',
    completed: 'nextCompleted',
  };
  return (status: string): string | null => {
    const key = actionKeys[status];
    return key ? t(key) : null;
  };
}

function MiniProgress({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : 'bg-cyan-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-gray-500 font-medium flex-shrink-0">{current}/{total}</span>
    </div>
  );
}

type MusicOrder = {
  id: string;
  order_number: string;
  email: string;
  vibe: string;
  tier: string;
  price: number;
  status: string;
  payment_status: string;
  created_at: string;
  download_url: string | null;
  _type: 'music';
};

type OrchestraOrder = {
  id: string;
  order_number: string;
  email: string;
  project_name: string;
  tier_name: string;
  duration_minutes: number;
  price: number;
  status: string;
  payment_status: string;
  created_at: string;
  midi_file_url: string | null;
  delivery_stems: string[] | null;
  _type: 'orchestra';
};

type VoiceOrder = Order & { _type: 'voice' };
type AnyOrder = VoiceOrder | MusicOrder | OrchestraOrder;

type Tab = 'voice' | 'music' | 'orchestra' | 'licenses';

type CertificateItem = {
  id: string;
  license_id: string;
  order_id: string;
  order_type: string;
  order_number: string;
  product_category: string;
  rights_level: string;
  pdf_url: string;
  issued_at: string;
  project_name: string | null;
};

function LicenseCard({ cert }: { cert: CertificateItem }) {
  const t = useTranslations('dashboard');
  const issuedDate = new Date(cert.issued_at).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  const rightsLabel =
    cert.rights_level === 'global' ? t('rightsGlobalFull') :
    cert.rights_level === 'broadcast' ? t('rightsBroadcastFull') :
    t('rightsStandardFull');

  const typeLabel =
    cert.order_type === 'voice' ? t('typeVoiceover') :
    cert.order_type === 'music' ? t('typeMusic') :
    t('typeStrings');

  const typeColor =
    cert.order_type === 'voice' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
    cert.order_type === 'music' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
    'text-amber-400 bg-amber-500/10 border-amber-500/20';

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500/[0.03] to-cyan-500/[0.02] backdrop-blur-sm border border-emerald-500/15 hover:border-emerald-500/30 transition-all duration-300">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mt-0.5">
              <Award className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-emerald-300 font-mono text-sm font-semibold">{cert.license_id}</p>
              <p className="text-gray-500 text-xs mt-0.5">{t('issuedOn', { date: issuedDate })}</p>
            </div>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${typeColor}`}>
            {typeLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg bg-white/[0.02] px-3 py-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{t('labelProduct')}</p>
            <p className="text-white text-xs font-medium">{cert.product_category || '—'}</p>
          </div>
          <div className="rounded-lg bg-white/[0.02] px-3 py-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{t('labelRights')}</p>
            <p className="text-white text-xs font-medium">{rightsLabel}</p>
          </div>
        </div>

        {cert.project_name && (
          <div className="rounded-lg bg-white/[0.02] px-3 py-2 mb-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{t('labelProject')}</p>
            <p className="text-white text-xs font-medium">{cert.project_name}</p>
          </div>
        )}

        <div className="flex items-center gap-2 pt-3 border-t border-white/[0.04]">
          {cert.pdf_url && (
            <a
              href={cert.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              PDF
            </a>
          )}
          <a
            href={`/verify/${cert.license_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-gray-300 text-xs font-semibold transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {t('verify')}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

function StatsCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] p-5">
      <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -translate-y-8 translate-x-8" />
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-lg bg-white/[0.05]">
          <Icon className="w-4 h-4 text-gray-400" />
        </div>
        <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function VoiceOrderCard({
  order,
  isAdmin,
  onRefresh,
}: {
  order: VoiceOrder;
  isAdmin: boolean;
  onRefresh: () => void;
}) {
  const t = useTranslations('dashboard');
  const router = useRouter();
  const relativeTime = useRelativeTime();
  const getNextAction = useNextAction();
  const displayName = order.project_name || `${order.tone_style} / ${order.voice_selection}`;
  const date = new Date(order.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const step = getStepInfo(order.status, VOICE_STEPS);
  const nextAction = getNextAction(order.status);

  return (
    <div
      onClick={() => router.push(`/dashboard/orders/${order.id}`)}
      className="group relative overflow-hidden rounded-xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300 cursor-pointer"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 mt-0.5">
              <FileAudio className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">{displayName}</h3>
              <p className="text-gray-500 text-xs mt-0.5">
                #{String(order.order_number).padStart(4, '0')} &middot; {date} &middot; <span className="text-gray-600">{relativeTime(order.created_at)}</span>
              </p>
            </div>
          </div>
          <StatusBadge status={order.status} />
        </div>

        {/* Mini progress bar */}
        <div className="mb-4">
          <MiniProgress current={step.current} total={step.total} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div className="rounded-lg bg-white/[0.02] px-3 py-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{t('labelLanguage')}</p>
            <p className="text-white text-xs font-medium">{order.language}</p>
          </div>
          <div className="rounded-lg bg-white/[0.02] px-3 py-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{t('labelUseCase')}</p>
            <p className="text-white text-xs font-medium">{order.use_case}</p>
          </div>
          <div className="rounded-lg bg-white/[0.02] px-3 py-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{t('labelTone')}</p>
            <p className="text-white text-xs font-medium">{order.tone_style}</p>
          </div>
          <div className="rounded-lg bg-white/[0.02] px-3 py-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{t('labelRights')}</p>
            <p className="text-white text-xs font-medium">
              {order.rights_level === 'global' ? t('rightsGlobalTvGame') : order.rights_level === 'broadcast' ? t('rightsBroadcastBuyout') : order.broadcast_rights ? t('rightsBroadcast') : t('rightsStandard')}
            </p>
          </div>
        </div>

        {/* Next action hint */}
        {nextAction && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <ArrowRight className="w-3 h-3 text-gray-500 flex-shrink-0" />
            <p className="text-[11px] text-gray-400">{nextAction}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.04]">
          {order.status === 'pending_payment' ? (
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 px-4"
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); router.push(`/checkout/${order.id}?type=voice`); }}
            >
              <CreditCard className="w-3.5 h-3.5 mr-1.5" />
              {t('buttonPayNow')}
            </Button>
          ) : order.status === 'delivered' ? (
            <Button
              size="sm"
              className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs h-8 px-4"
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); router.push(`/dashboard/orders/${order.id}`); }}
            >
              {t('buttonReviewDelivery')}
            </Button>
          ) : order.status === 'completed' ? (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white text-xs h-8 px-4"
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); router.push(`/dashboard/orders/${order.id}`); }}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              {t('buttonDownloadFiles')}
            </Button>
          ) : (
            <Button size="sm" disabled className="bg-white/[0.05] text-gray-500 text-xs h-8 px-4 cursor-not-allowed">
              <Clock className="w-3.5 h-3.5 mr-1.5" />
              {order.status === 'in_production' ? t('statusInProduction') : order.status === 'awaiting_final' ? t('finalizing') : t('inQueue')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function MusicOrderCard({ order }: { order: MusicOrder }) {
  const t = useTranslations('dashboard');
  const router = useRouter();
  const relativeTime = useRelativeTime();
  const getNextAction = useNextAction();
  const date = new Date(order.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const step = getStepInfo(order.status, MUSIC_STEPS);
  const nextAction = getNextAction(order.status);

  return (
    <div
      onClick={() => router.push(`/dashboard/orders/${order.id}`)}
      className="group relative overflow-hidden rounded-xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300 cursor-pointer"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mt-0.5">
              <Music className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">{t('musicProduction')}</h3>
              <p className="text-gray-500 text-xs mt-0.5">#{order.order_number} &middot; {date} &middot; <span className="text-gray-600">{relativeTime(order.created_at)}</span></p>
            </div>
          </div>
          <StatusBadge status={order.status} />
        </div>

        <div className="mb-4">
          <MiniProgress current={step.current} total={step.total} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          <div className="rounded-lg bg-white/[0.02] px-3 py-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{t('labelVibe')}</p>
            <p className="text-white text-xs font-medium">{order.vibe || '—'}</p>
          </div>
          <div className="rounded-lg bg-white/[0.02] px-3 py-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{t('labelPlan')}</p>
            <p className="text-white text-xs font-medium">{getMusicTierLabel(order.tier) || '—'}</p>
          </div>
          <div className="rounded-lg bg-white/[0.02] px-3 py-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{t('labelAmount')}</p>
            <p className="text-white text-xs font-medium">US${order.price?.toLocaleString()}</p>
          </div>
        </div>

        {nextAction && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <ArrowRight className="w-3 h-3 text-gray-500 flex-shrink-0" />
            <p className="text-[11px] text-gray-400">{nextAction}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.04]">
          {order.status === 'pending_payment' ? (
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 px-4"
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); router.push(`/checkout/${order.id}?type=music`); }}
            >
              <CreditCard className="w-3.5 h-3.5 mr-1.5" />
              {t('buttonPayNow')}
            </Button>
          ) : order.status === 'demo_ready' || order.status === 'client_reviewing' ? (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 px-4"
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); router.push(`/dashboard/orders/${order.id}`); }}
            >
              {t('reviewDemos')}
            </Button>
          ) : order.status === 'completed' ? (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white text-xs h-8 px-4"
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); router.push(`/dashboard/orders/${order.id}`); }}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              {t('buttonDownloadFiles')}
            </Button>
          ) : (
            <Button size="sm" disabled className="bg-white/[0.05] text-gray-500 text-xs h-8 px-4 cursor-not-allowed">
              <Clock className="w-3.5 h-3.5 mr-1.5" />
              {order.status === 'revising' ? t('revising') : order.status === 'in_production' ? t('statusInProduction') : t('inQueue')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function OrchestraOrderCard({ order }: { order: OrchestraOrder }) {
  const t = useTranslations('dashboard');
  const router = useRouter();
  const relativeTime = useRelativeTime();
  const getNextAction = useNextAction();
  const date = new Date(order.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const step = getStepInfo(order.status, ORCH_STEPS);
  const nextAction = getNextAction(order.status);
  const needsFileUpload = order.status === 'awaiting_files' && !order.midi_file_url;

  return (
    <div
      onClick={() => router.push(`/dashboard/orchestra/${order.id}`)}
      className={`group relative overflow-hidden rounded-xl bg-white/[0.03] backdrop-blur-sm border transition-all duration-300 cursor-pointer ${
        needsFileUpload ? 'border-amber-500/30 hover:border-amber-500/50' : 'border-white/[0.06] hover:border-amber-500/20'
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 mt-0.5">
              <Music2 className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">{order.project_name || t('stringsProject')}</h3>
              <p className="text-gray-500 text-xs mt-0.5">#{order.order_number} &middot; {date} &middot; <span className="text-gray-600">{relativeTime(order.created_at)}</span></p>
            </div>
          </div>
          <StatusBadge status={order.status} />
        </div>

        <div className="mb-4">
          <MiniProgress current={step.current} total={step.total} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          <div className="rounded-lg bg-white/[0.02] px-3 py-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{t('labelSetup')}</p>
            <p className="text-white text-xs font-medium">{order.tier_name || '—'}</p>
          </div>
          <div className="rounded-lg bg-white/[0.02] px-3 py-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{t('labelDuration')}</p>
            <p className="text-white text-xs font-medium">{t('durationMin', { min: order.duration_minutes })}</p>
          </div>
          <div className="rounded-lg bg-white/[0.02] px-3 py-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{t('labelAmount')}</p>
            <p className="text-white text-xs font-medium">US${order.price?.toLocaleString()}</p>
          </div>
        </div>

        {/* Action-needed banner for file upload */}
        {needsFileUpload && (
          <div className="flex items-center gap-3 mb-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/25">
            <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className="text-xs text-amber-300 font-medium">{t('actionUploadRequired')}</p>
          </div>
        )}

        {nextAction && !needsFileUpload && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <ArrowRight className="w-3 h-3 text-gray-500 flex-shrink-0" />
            <p className="text-[11px] text-gray-400">{nextAction}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.04]">
          {needsFileUpload ? (
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 px-4"
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); router.push(`/dashboard/orchestra/${order.id}`); }}
            >
              {t('buttonUploadMidiScore')}
              <ArrowRight className="w-3 h-3 ml-1.5" />
            </Button>
          ) : order.status === 'completed' && order.delivery_stems?.length ? (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white text-xs h-8 px-4"
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); router.push(`/dashboard/orchestra/${order.id}`); }}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              {t('downloadStems')}
            </Button>
          ) : (
            <Button size="sm" disabled className="bg-white/[0.05] text-gray-500 text-xs h-8 px-4 cursor-not-allowed">
              <Clock className="w-3.5 h-3.5 mr-1.5" />
              {order.status === 'in_production' ? t('statusInProduction') : order.status === 'awaiting_files' ? t('awaitingFiles') : t('inQueue')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ type }: { type: Tab }) {
  const t = useTranslations('dashboard');
  const config: Record<Tab, { icon: typeof Mic2; titleKey: string; descKey: string; ctaKey: string; href: string; color: string }> = {
    voice: {
      icon: Mic2,
      titleKey: 'emptyVoiceTitle',
      descKey: 'emptyVoiceDesc',
      ctaKey: 'emptyVoiceCta',
      href: '/voice/create',
      color: 'text-blue-400',
    },
    music: {
      icon: Music,
      titleKey: 'emptyMusicTitle',
      descKey: 'emptyMusicDesc',
      ctaKey: 'emptyMusicCta',
      href: '/music/create',
      color: 'text-emerald-400',
    },
    orchestra: {
      icon: Music2,
      titleKey: 'emptyOrchestraTitle',
      descKey: 'emptyOrchestraDesc',
      ctaKey: 'emptyOrchestraCta',
      href: '/music/orchestra/order',
      color: 'text-amber-400',
    },
  };

  const { icon: Icon, titleKey, descKey, ctaKey, href, color } = config[type];

  return (
    <div className="relative overflow-hidden rounded-xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] py-20 text-center">
      <div className="relative">
        <div className={`mx-auto w-16 h-16 rounded-2xl bg-white/[0.05] flex items-center justify-center mb-5`}>
          <Icon className={`w-7 h-7 ${color} opacity-50`} />
        </div>
        <h3 className="text-lg font-semibold text-gray-300 mb-2">{t(titleKey)}</h3>
        <p className="text-gray-600 text-sm max-w-sm mx-auto mb-6">{t(descKey)}</p>
        <Link href={href}>
          <Button className="bg-white/10 hover:bg-white/15 text-white text-sm border border-white/10">
            {t(ctaKey)}
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

const TAB_CONFIG: { id: Tab; labelKey: string; icon: typeof Mic2; accent: string }[] = [
  { id: 'voice', labelKey: 'tabVoiceover', icon: Mic2, accent: 'text-blue-400 border-blue-400' },
  { id: 'music', labelKey: 'tabMusic', icon: Music, accent: 'text-emerald-400 border-emerald-400' },
  { id: 'orchestra', labelKey: 'tabStrings', icon: Music2, accent: 'text-amber-400 border-amber-400' },
  { id: 'licenses', labelKey: 'tabLicenses', icon: Award, accent: 'text-emerald-400 border-emerald-400' },
];

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const user = useDashboardUser();
  const [activeTab, setActiveTab] = useState<Tab>('voice');
  const [voiceOrders, setVoiceOrders] = useState<VoiceOrder[]>([]);
  const [musicOrders, setMusicOrders] = useState<MusicOrder[]>([]);
  const [orchestraOrders, setOrchestraOrders] = useState<OrchestraOrder[]>([]);
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const fetchOrders = useCallback(async () => {
    if (!user.email) return;
    setLoading(true);
    try {
      const [voiceRes, musicRes, orchApiRes] = await Promise.all([
        supabase
          .from('voice_orders')
          .select('*')
          .eq('email', user.email)
          .in('status', ['pending_payment', 'paid', 'processing', 'in_queue', 'pending', 'completed', 'failed', 'in_production', 'delivered', 'awaiting_final'])
          .order('created_at', { ascending: false }),
        supabase
          .from('music_orders')
          .select('*')
          .eq('email', user.email)
          .not('status', 'in', '("draft")')
          .order('created_at', { ascending: false }),
        fetch(`/api/orders/orchestra?email=${encodeURIComponent(user.email)}`).then(r => r.json()).catch(() => []),
      ]);

      setVoiceOrders((voiceRes.data || []).map((o) => ({ ...o, _type: 'voice' as const })));
      setMusicOrders((musicRes.data || []).map((o) => ({ ...o, _type: 'music' as const })));
      setOrchestraOrders((Array.isArray(orchApiRes) ? orchApiRes : []).map((o: any) => ({ ...o, _type: 'orchestra' as const })));

      const { data: certData } = await supabase
        .from('certificates')
        .select('id, license_id, order_id, order_type, order_number, product_category, rights_level, pdf_url, issued_at, project_name')
        .eq('client_email', user.email)
        .order('issued_at', { ascending: false });
      setCertificates(certData || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user.email]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const totalOrders = voiceOrders.length + musicOrders.length + orchestraOrders.length;
  const allOrders: AnyOrder[] = [...voiceOrders, ...musicOrders, ...orchestraOrders];
  const stats = {
    total: totalOrders,
    completed: allOrders.filter((o) => o.status === 'completed').length,
    inProgress: allOrders.filter((o) => !['completed', 'failed'].includes(o.status)).length,
  };

  const tabCounts: Record<Tab, number> = {
    voice: voiceOrders.length,
    music: musicOrders.length,
    orchestra: orchestraOrders.length,
    licenses: certificates.length,
  };

  return (
    <div className="text-white p-6 lg:p-10">
      <div className="max-w-5xl">
        <div className="mb-8">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2 font-medium">{t('studioPortal')}</p>
          <h1 className="text-3xl font-bold tracking-tight">{t('yourProjects')}</h1>
          <p className="text-gray-500 text-sm mt-1">{user.user_metadata?.full_name || user.email}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <StatsCard icon={FileAudio} label={t('totalProjects')} value={stats.total} />
          <StatsCard icon={Activity} label={t('inProgress')} value={stats.inProgress} />
          <StatsCard icon={CheckCircle2} label={t('completed')} value={stats.completed} />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-8 w-fit">
          {TAB_CONFIG.map(({ id, labelKey, icon: Icon, accent }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active ? 'bg-white/[0.08] text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? accent.split(' ')[0] : ''}`} />
                {t(labelKey)}
                {tabCounts[id] > 0 && (
                  <span className={`ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/10 text-gray-300' : 'bg-white/[0.05] text-gray-600'}`}>
                    {tabCounts[id]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
          </div>
        ) : (
          <>
            {activeTab === 'voice' && (
              voiceOrders.length === 0 ? (
                <EmptyState type="voice" />
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-semibold text-white">{t('voiceoverOrders')}</h2>
                    <Badge variant="outline" className="text-gray-300 border-white/15 text-xs">
                      {voiceOrders.length} {voiceOrders.length === 1 ? t('orderUnit') : t('ordersUnit')}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {voiceOrders.map((o) => (
                      <VoiceOrderCard key={o.id} order={o} isAdmin={isAdmin} onRefresh={fetchOrders} />
                    ))}
                  </div>
                </div>
              )
            )}

            {activeTab === 'music' && (
              musicOrders.length === 0 ? (
                <EmptyState type="music" />
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-semibold text-white">{t('musicProductionOrders')}</h2>
                    <Badge variant="outline" className="text-gray-300 border-white/15 text-xs">
                      {musicOrders.length} {musicOrders.length === 1 ? t('orderUnit') : t('ordersUnit')}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {musicOrders.map((o) => (
                      <MusicOrderCard key={o.id} order={o} />
                    ))}
                  </div>
                </div>
              )
            )}

            {activeTab === 'orchestra' && (
              orchestraOrders.length === 0 ? (
                <EmptyState type="orchestra" />
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-semibold text-white">{t('stringsSessions')}</h2>
                    <Badge variant="outline" className="text-gray-300 border-white/15 text-xs">
                      {orchestraOrders.length} {orchestraOrders.length === 1 ? t('sessionUnit') : t('sessionsUnit')}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {orchestraOrders.map((o) => (
                      <OrchestraOrderCard key={o.id} order={o} />
                    ))}
                  </div>
                </div>
              )
            )}

            {activeTab === 'licenses' && (
              certificates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-4">
                    <Award className="w-8 h-8 text-gray-600" />
                  </div>
                  <h3 className="text-white font-semibold mb-1">{t('noLicensesTitle')}</h3>
                  <p className="text-gray-500 text-sm max-w-sm">
                    {t('noLicensesDesc')}
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-semibold text-white">{t('licenseCertificates')}</h2>
                    <Badge variant="outline" className="text-gray-300 border-white/15 text-xs">
                      {certificates.length} {certificates.length === 1 ? t('licenseUnit') : t('licensesUnit')}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {certificates.map((cert) => (
                      <LicenseCard key={cert.id} cert={cert} />
                    ))}
                  </div>
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
