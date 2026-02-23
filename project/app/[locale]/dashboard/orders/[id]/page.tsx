'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { supabase, Order } from '@/lib/supabase';
import { useDashboardUser } from '@/contexts/DashboardContext';
import { getVoiceTierLabel, getMusicTierLabel } from '@/lib/config/pricing.config';
import StatusBadge from '@/components/dashboard/StatusBadge';
import EditOrderModal from '@/components/dashboard/EditOrderModal';
import MusicOrderDetail from '@/components/dashboard/MusicOrderDetail';
import VoiceOrderDetail from '@/components/dashboard/VoiceOrderDetail';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Loader2,
  Download,
  Pencil,
  Lock,
  FileAudio,
  Music,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import AdminUpload from '@/components/admin/AdminUpload';
import AudioPlayer from '@/components/AudioPlayer';


const ADMIN_EMAIL = 'admin@onyxstudios.ai';
const VOICE_EDITABLE_STATUSES = ['pending', 'in_queue', 'paid'];
const SCRIPT_PREVIEW_LINES = 5;

function CollapsibleScript({ text, label }: { text: string; label?: string }) {
  const t = useTranslations('dashboard.orderDetail');
  const [expanded, setExpanded] = useState(false);
  const lines = text.split('\n');
  const needsCollapse = lines.length > SCRIPT_PREVIEW_LINES || text.length > 300;
  const preview = needsCollapse
    ? lines.slice(0, SCRIPT_PREVIEW_LINES).join('\n') + (lines.length > SCRIPT_PREVIEW_LINES ? '…' : '')
    : text;

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-5 py-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label || t('fullScript')}</p>
        {needsCollapse && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            {expanded ? (
              <><ChevronUp className="w-3.5 h-3.5" /> {t('collapse')}</>
            ) : (
              <><ChevronDown className="w-3.5 h-3.5" /> {t('showAllLines', { count: lines.length })}</>
            )}
          </button>
        )}
      </div>
      <div className={`relative ${!expanded && needsCollapse ? 'max-h-[7.5rem] overflow-hidden' : ''}`}>
        <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap font-mono break-words">
          {expanded || !needsCollapse ? text : preview}
        </p>
        {!expanded && needsCollapse && (
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[#0a0a0a] to-transparent pointer-events-none" />
        )}
      </div>
    </div>
  );
}

interface TalentInfo {
  id: string;
  name: string;
  headshot_url: string | null;
  tags: string[] | null;
  languages: string[] | null;
}

interface MusicOrderData {
  id: string;
  order_number: string;
  email: string;
  vibe: string;
  tier: string;
  price: number;
  status: string;
  description: string;
  reference_link: string | null;
  usage_type: string | null;
  string_addon: string | null;
  talent_id: string | null;
  talent_price: number | null;
  created_at: string;
  confirmed_version_id: string | null;
  awaiting_final_upload: boolean;
  version_count: number;
  max_versions: number;
  estimated_delivery_date: string | null;
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations('dashboard.orderDetail');
  const user = useDashboardUser();
  const [order, setOrder] = useState<Order | null>(null);
  const [musicOrder, setMusicOrder] = useState<MusicOrderData | null>(null);
  const [talentInfo, setTalentInfo] = useState<TalentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const fetchOrder = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: voiceData } = await supabase
        .from('voice_orders')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (voiceData) {
        setOrder(voiceData);
        setMusicOrder(null);
        setLoading(false);
        return;
      }

      const { data: musicData } = await supabase
        .from('music_orders')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (musicData) {
        setMusicOrder(musicData);
        setOrder(null);
        if (musicData.talent_id) {
          const { data: talentData } = await supabase
            .from('talents')
            .select('id, name, headshot_url, tags, languages')
            .eq('id', musicData.talent_id)
            .maybeSingle();
          setTalentInfo(talentData || null);
        } else {
          setTalentInfo(null);
        }
        setLoading(false);
        return;
      }

      router.push('/dashboard');
    } catch {
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
      </div>
    );
  }

  if (musicOrder) {
    const date = new Date(musicOrder.created_at).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });

    const tierLabel = getMusicTierLabel(musicOrder.tier);

    const stringAddonLabel =
      musicOrder.string_addon === 'intimate-ensemble' ? t('intimateEnsemble') :
      musicOrder.string_addon === 'rich-studio-strings' ? t('richStudioStrings') :
      musicOrder.string_addon === 'cinematic-symphony' ? t('cinematicSymphony') :
      musicOrder.string_addon || t('none');

    const details = [
      { label: t('vibeGenre'), value: musicOrder.vibe },
      { label: t('plan'), value: tierLabel },
      { label: t('usageType'), value: musicOrder.usage_type || '—' },
      { label: t('stringAddon'), value: stringAddonLabel },
      { label: t('price'), value: `US$${Number(musicOrder.price).toLocaleString()}` },
    ];

    return (
      <div className="text-white p-6 lg:p-10">
        <div className="max-w-3xl">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('backToProjects')}
          </button>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Music className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h1 className="text-2xl font-bold tracking-tight">{musicOrder.vibe}</h1>
                  <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-xs">{t('badgeMusic')}</Badge>
                </div>
                <p className="text-gray-500 text-sm">
                  #{musicOrder.order_number} &middot; {date}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <StatusBadge status={musicOrder.status as Order['status']} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {details.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3"
                >
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{item.label}</p>
                  <p className="text-white text-sm font-medium">{item.value}</p>
                </div>
              ))}
            </div>

            {musicOrder.description && <CollapsibleScript text={musicOrder.description} label={t('briefDescription')} />}

            {musicOrder.reference_link && (
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-5 py-4">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">{t('referenceSonicRef')}</p>
                <a
                  href={musicOrder.reference_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors break-all"
                >
                  {musicOrder.reference_link}
                </a>
              </div>
            )}

            {talentInfo && (
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-5 py-4">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">{t('vocalistAddon')}</p>
                <div className="flex items-center gap-4">
                  {talentInfo.headshot_url && (
                    <img
                      src={talentInfo.headshot_url}
                      alt={talentInfo.name}
                      className="w-12 h-12 rounded-full object-cover flex-shrink-0 border border-white/10"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm">{talentInfo.name}</p>
                    {talentInfo.languages && talentInfo.languages.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {talentInfo.languages.slice(0, 3).map((lang, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/20">
                            {lang}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {musicOrder.talent_price && musicOrder.talent_price > 0 && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{t('addonPrice')}</p>
                      <p className="text-pink-400 font-semibold text-sm">US${Number(musicOrder.talent_price).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <MusicOrderDetail
              order={musicOrder}
              onRefresh={fetchOrder}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!order) return null;

  const canEdit = VOICE_EDITABLE_STATUSES.includes(order.status);
  const isLocked = order.status === 'completed';

  const date = new Date(order.created_at).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const displayName = order.project_name || `${order.tone_style} / ${order.voice_selection}`;

  const details = [
    { label: t('language'), value: order.language },
    { label: t('voice'), value: order.voice_selection },
    { label: t('tone'), value: order.tone_style },
    { label: t('useCase'), value: order.use_case },
    { label: t('plan'), value: getVoiceTierLabel(order.tier) },
    { label: t('rights'), value: order.rights_level === 'global' ? t('rightsGlobalTvGame') : order.rights_level === 'broadcast' ? t('rightsBroadcastBuyout') : order.broadcast_rights ? t('rightsBroadcastBuyout') : t('rightsStandard') },
    { label: t('duration'), value: `${order.duration} ${order.duration !== 1 ? t('mins') : t('min')}` },
    { label: t('price'), value: `US$${Number(order.price).toFixed(2)}` },
  ];

  return (
    <div className="text-white p-6 lg:p-10">
      <div className="max-w-3xl">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('backToProjects')}
          </button>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <FileAudio className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
              <p className="text-gray-500 text-sm mt-0.5">
                #{String(order.order_number).padStart(4, '0')} &middot; {date}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={order.status} />
            {canEdit && (
              <Button
                onClick={() => setEditOpen(true)}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                {t('editProject')}
              </Button>
            )}
            {isLocked && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/[0.05] text-gray-400 border border-white/10">
                <Lock className="w-3 h-3" />
                {t('orderCompleted')}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {details.map((item) => (
              <div
                key={item.label}
                className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3"
              >
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{item.label}</p>
                <p className="text-white text-sm font-medium">{item.value}</p>
              </div>
            ))}
          </div>

          {order.script_text && <CollapsibleScript text={order.script_text} />}

          <VoiceOrderDetail
            order={{
              id: order.id,
              order_number: String(order.order_number),
              email: order.email,
              status: order.status,
              tier: order.tier,
              revision_count: (order as Record<string, unknown>).revision_count as number ?? 0,
              max_revisions: (order as Record<string, unknown>).max_revisions as number ?? 2,
            }}
            onRefresh={fetchOrder}
          />
        </div>

        {editOpen && (
          <EditOrderModal
            order={order}
            isOpen={editOpen}
            onClose={() => setEditOpen(false)}
            onSaved={fetchOrder}
          />
        )}
      </div>
    </div>
  );
}
