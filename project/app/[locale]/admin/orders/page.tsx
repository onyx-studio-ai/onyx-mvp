'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Search, RefreshCw, ChevronRight, Play, Music, Mic, ExternalLink, Music2, ChevronDown, ChevronUp, Award, Loader2, Send, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { currencySymbol } from '@/lib/currency';
import MusicOrderWorkflow from '@/components/admin/MusicOrderWorkflow';
import VoiceOrderWorkflow from '@/components/admin/VoiceOrderWorkflow';
import OrchestraOrderWorkflow from '@/components/admin/OrchestraOrderWorkflow';
import { getVoiceTierLabel, getMusicTierLabel } from '@/lib/config/pricing.config';

const PREVIEW_LINES = 5;

function CollapsibleText({ text, label, mono }: { text: string; label: string; mono?: boolean }) {
  const t = useTranslations('admin.orders');
  const [expanded, setExpanded] = useState(false);
  const lines = text.split('\n');
  const needsCollapse = lines.length > PREVIEW_LINES || text.length > 300;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
        {needsCollapse && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-purple-700 hover:text-purple-700 transition-colors"
          >
            {expanded ? (
              <><ChevronUp className="w-3.5 h-3.5" /> {t('collapse')}</>
            ) : (
              <><ChevronDown className="w-3.5 h-3.5" /> {t('showAllLines', { count: lines.length })}</>
            )}
          </button>
        )}
      </div>
      <div className={`relative bg-white rounded-lg px-4 py-3 ${!expanded && needsCollapse ? 'max-h-[7.5rem] overflow-hidden' : ''}`}>
        <p className={`text-gray-700 text-sm leading-relaxed whitespace-pre-wrap break-words ${mono ? 'font-mono' : ''}`}>
          {text}
        </p>
        {!expanded && needsCollapse && (
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-zinc-900 to-transparent pointer-events-none rounded-b-lg" />
        )}
      </div>
    </div>
  );
}

interface VoiceOrder {
  id: string;
  order_number: number;
  email: string;
  tier: string;
  price: number;
  currency?: string | null;
  status: string;
  payment_status: string | null;
  paid_at: string | null;
  created_at: string;
  voice_selection: string;
  project_name: string;
  script_text: string;
  download_url: string | null;
  broadcast_rights: boolean;
  rights_level: string | null;
  use_case: string;
  revision_count: number;
  max_revisions: number;
  type: 'voice';
}

interface MusicOrder {
  id: string;
  order_number: string;
  email: string;
  tier: string;
  price: number;
  status: string;
  payment_status: string | null;
  paid_at: string | null;
  created_at: string;
  vibe: string;
  description: string;
  reference_link: string | null;
  usage_type: string | null;
  download_url: string | null;
  string_addon: string | null;
  confirmed_version_id: string | null;
  awaiting_final_upload: boolean;
  version_count: number;
  max_versions: number;
  talent_id: string | null;
  talent_name: string | null;
  type: 'music';
}

interface StringsOrder {
  id: string;
  order_number: string;
  email: string;
  tier_name: string;
  price: number;
  status: string;
  payment_status: string | null;
  created_at: string;
  project_name: string;
  duration_minutes: number;
  genre: string;
  description: string;
  reference_url: string | null;
  usage_type: string | null;
  midi_file_url: string | null;
  score_file_url: string | null;
  delivery_stems: string[] | null;
  notes: string | null;
  type: 'strings';
}

type AnyOrder = VoiceOrder | MusicOrder | StringsOrder;
type StatusFilter = 'all' | 'paid' | 'processing' | 'completed' | 'pending_payment' | 'in_production' | 'version_ready' | 'awaiting_final' | 'awaiting_files' | 'delivered';

// 顯示文字走 i18n:把 t 傳進來,只換 badge 文字不動 status 判斷邏輯。
function getStatusBadge(status: string, t: ReturnType<typeof useTranslations>) {
  switch (status) {
    case 'paid':
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 whitespace-nowrap">{t('badgeInQueue')}</Badge>;
    case 'processing':
    case 'in_production':
      return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 whitespace-nowrap">{t('badgeInProduction')}</Badge>;
    case 'demo_ready':
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 whitespace-nowrap">{t('badgeDemoReady')}</Badge>;
    case 'client_reviewing':
      return <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-200 whitespace-nowrap">{t('badgeClientReviewing')}</Badge>;
    case 'revising':
      return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 whitespace-nowrap">{t('badgeRevising')}</Badge>;
    case 'delivered':
      return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 whitespace-nowrap">{t('badgeDelivered')}</Badge>;
    case 'awaiting_final':
      return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 whitespace-nowrap">{t('badgeAwaitingFinal')}</Badge>;
    case 'completed':
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 whitespace-nowrap">{t('badgeComplete')}</Badge>;
    case 'pending_payment':
      return <Badge variant="outline" className="bg-gray-400/10 text-gray-500 border-gray-300 whitespace-nowrap">{t('badgePendingPayment')}</Badge>;
    default:
      return <Badge variant="outline" className="bg-gray-400/10 text-gray-500 border-gray-300 whitespace-nowrap">{status}</Badge>;
  }
}

async function callUpdateOrder(orderId: string, orderType: 'voice' | 'music' | 'strings', updates: Record<string, unknown>, sb?: typeof supabase) {
  if (orderType === 'strings') {
    const res = await fetch('/api/orders/orchestra', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: orderId, ...updates }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || 'Failed to update order');
    }
    return;
  }
  const res = await fetch('/api/admin/orders', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, orderType, updates }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to update order');
  }
}

function deriveRightsLevel(order: AnyOrder): 'standard' | 'broadcast' | 'global' {
  if (order.type === 'strings') return 'global';
  if (order.type === 'voice') {
    const vo = order as VoiceOrder;
    if (vo.tier === 'tier-3') return 'global';
    if (vo.rights_level === 'global') return 'global';
    if (vo.rights_level === 'broadcast') return 'broadcast';
    if (vo.broadcast_rights) return 'broadcast';
    return (vo.rights_level as 'standard' | 'broadcast' | 'global') || 'standard';
  }
  if (order.type === 'music') {
    const mo = order as MusicOrder;
    if (mo.tier === 'masterpiece') return 'global';
    if (mo.tier === 'pro-arrangement') return 'broadcast';
    return 'standard';
  }
  return 'standard';
}

// 顯示文字走 i18n:t 由呼叫端傳入,只換文字不動 level 判斷。
function rightsLevelLabel(level: string, t: ReturnType<typeof useTranslations>): string {
  if (level === 'global') return t('rightsGlobal');
  if (level === 'broadcast') return t('rightsBroadcast');
  return t('rightsStandard');
}

function CertificateSection({ order }: { order: AnyOrder }) {
  const t = useTranslations('admin.orders');
  const [certState, setCertState] = useState<'idle' | 'loading' | 'exists' | 'generating'>('idle');
  const [cert, setCert] = useState<{ license_id: string; pdf_url: string } | null>(null);
  const autoRights = deriveRightsLevel(order);
  const [rightsLevel] = useState(autoRights);
  const [projectName, setProjectName] = useState('');
  const [sendToClient, setSendToClient] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/certificates?order_number=${order.order_number}`)
      .then(r => r.json())
      .then(data => {
        if (data.data && data.data.length > 0) {
          setCert(data.data[0]);
          setCertState('exists');
        } else {
          setCertState('idle');
        }
      })
      .catch(() => setCertState('idle'));
  }, [order.order_number]);

  const generate = async () => {
    setCertState('generating');
    try {
      const orderType = order.type === 'strings' ? 'orchestra' : order.type;
      const tier = order.type === 'voice'
        ? (order as VoiceOrder).tier
        : order.type === 'music'
        ? (order as MusicOrder).tier
        : (order as StringsOrder).tier_name;

      const res = await fetch('/api/admin/certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          orderNumber: String(order.order_number),
          orderType,
          tier,
          rightsLevel,
          clientEmail: order.email,
          projectName: projectName || `Order #${order.order_number}`,
          talentId: (order as any).talent_id || null,
          sendToClient,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCert(data.certificate);
        setCertState('exists');
      } else {
        setCertState('idle');
        toast.error(data.error || t('certFailGenerate'));
      }
    } catch {
      setCertState('idle');
      toast.error(t('certFailGenerate'));
    }
  };

  if (certState === 'loading') return null;

  if (certState === 'exists' && cert) {
    return (
      <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
        <Award className="w-5 h-5 text-green-700 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-green-700 font-mono text-sm font-medium">#{cert.license_id}</p>
          <p className="text-gray-500 text-xs">{t('certIssued')}</p>
        </div>
        <a href={cert.pdf_url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs transition-colors">
          <Download className="w-3 h-3" /> {t('certPdf')}
        </a>
        <a href={`/verify/${cert.license_id}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs transition-colors">
          <ExternalLink className="w-3 h-3" /> {t('certVerify')}
        </a>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white/50 border border-gray-200 rounded-xl space-y-3">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Award className="w-4 h-4" />
        <span className="font-medium">{t('certGenerateTitle')}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">{t('certProjectName')}</label>
          <input
            type="text"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            placeholder={t('certProjectPlaceholder', { num: order.order_number })}
            className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">{t('certRightsAuto')}</label>
          <div className={`w-full bg-gray-100/50 border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-medium ${
            autoRights === 'global' ? 'text-emerald-700' : autoRights === 'broadcast' ? 'text-blue-700' : 'text-gray-700'
          }`}>
            {rightsLevelLabel(autoRights, t)}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" checked={sendToClient} onChange={e => setSendToClient(e.target.checked)}
            className="rounded border-gray-400" />
          {t('certEmailToClient')}
        </label>
        <button
          onClick={generate}
          disabled={certState === 'generating'}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {certState === 'generating' ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('certGenerating')}</>
          ) : (
            <><Award className="w-3.5 h-3.5" /> {t('certGenerate')}</>
          )}
        </button>
      </div>
    </div>
  );
}

export default function AdminOrdersPage() {
  const t = useTranslations('admin.orders');
  const searchParams = useSearchParams();
  const [voiceOrders, setVoiceOrders] = useState<VoiceOrder[]>([]);
  const [musicOrders, setMusicOrders] = useState<MusicOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [filterType, setFilterType] = useState<'all' | 'voice' | 'music' | 'strings'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDate, setBulkDate] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);

  const [stringsOrders, setStringsOrders] = useState<StringsOrder[]>([]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const [voiceResult, musicResult, strings] = await Promise.all([
        supabase
          .from('voice_orders')
          .select('*')
          .neq('status', 'draft')
          .order('created_at', { ascending: false }),
        supabase
          .from('music_orders')
          .select('id, order_number, email, tier, price, status, payment_status, paid_at, created_at, vibe, description, reference_link, usage_type, download_url, string_addon, version_count, max_versions, confirmed_version_id, awaiting_final_upload, talent_id, talents(name)')
          .neq('status', 'draft')
          .order('created_at', { ascending: false }),
        fetch('/api/orders/orchestra?all=1')
          .then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => null) }))
          .catch(() => ({ ok: false, body: null })),
      ]);

      if (voiceResult.error) {
        setUpdateError(t('errLoadVoice', { msg: voiceResult.error.message }));
      }
      if (musicResult.error) {
        setUpdateError(t('errLoadMusic', { msg: musicResult.error.message }));
      }

      setVoiceOrders((voiceResult.data || []).map(o => ({ ...o, revision_count: o.revision_count ?? 0, max_revisions: o.max_revisions ?? 2, type: 'voice' as const })));
      setMusicOrders((musicResult.data || []).map(o => {
        const raw = o as typeof o & { talents?: { name: string } | null };
        return { ...o, talent_name: raw.talents?.name ?? null, type: 'music' as const };
      }));
      // Don't swallow orchestra failures — an error response used to map silently to
      // [] and the orders just disappeared. Surface it like voice/music errors.
      const stringsData = Array.isArray(strings.body) ? strings.body : [];
      if (!strings.ok) {
        const msg = (strings.body && typeof strings.body === 'object' && 'error' in strings.body) ? String((strings.body as { error: unknown }).error) : 'request failed';
        setUpdateError(t('errLoadOrchestra', { msg }));
      }
      setStringsOrders(stringsData.map((o: any) => ({ ...o, type: 'strings' as const })));
    } catch (err) {
      console.error('Error fetching orders:', err);
      setUpdateError(t('errLoadOrders', { msg: err instanceof Error ? err.message : t('errUnknown') }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const allOrders: AnyOrder[] = [
    ...voiceOrders,
    ...musicOrders,
    ...stringsOrders,
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const filtered = allOrders.filter(order => {
    const term = searchTerm.toLowerCase();
    // 全文比對:案名/角色/評語等所有文字欄位都搜得到(Wing 2026-07-21)
    const matchesSearch = !term ||
      String(order.order_number).toLowerCase().includes(term) ||
      Object.values(order).some(v => typeof v === 'string' && v.toLowerCase().includes(term));
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const matchesType = filterType === 'all' || order.type === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  const queueCount = allOrders.filter(o => o.status === 'paid').length;
  const productionCount = allOrders.filter(o => ['processing', 'in_production', 'demo_ready', 'client_reviewing', 'revising', 'delivered', 'awaiting_final'].includes(o.status)).length;
  const completedCount = allOrders.filter(o => o.status === 'completed').length;

  // ── Bulk operations on the filtered list (checkbox-select) ──
  const selectedOrders = allOrders.filter(o => selected.has(o.id));
  const allFilteredSelected = filtered.length > 0 && filtered.every(o => selected.has(o.id));
  const toggleSelect = (id: string) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleSelectAll = () => setSelected(allFilteredSelected ? new Set() : new Set(filtered.map(o => o.id)));

  function exportCsv() {
    const rows = selectedOrders.length ? selectedOrders : filtered;
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['order_number', 'type', 'status', 'email', 'price', 'currency', 'project', 'created_at'];
    const lines = [head.join(',')];
    for (const o of rows) {
      const r = o as { project_name?: string; vibe?: string; currency?: string };
      lines.push([o.order_number, o.type, o.status, o.email, o.price, r.currency || '', r.project_name || r.vibe || '', o.created_at].map(esc).join(','));
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `onyx-orders-${rows.length}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // 勾選的語音訂單 → 一鍵打包下載配音員最新交付檔(zip;伺服器端抓檔,大 WAV 也行)
  async function downloadDeliveries() {
    const voiceIds = selectedOrders.filter(o => o.type === 'voice').map(o => o.id);
    if (!voiceIds.length) { toast.error(t('zipNoVoice')); return; }
    setZipBusy(true);
    try {
      const res = await fetch('/api/admin/orders/download-deliveries', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: voiceIds }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `HTTP ${res.status}`); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `onyx-deliveries-${voiceIds.length}.zip`; a.click();
      URL.revokeObjectURL(url);
      const skipped = res.headers.get('X-Skipped-Orders');
      if (skipped) toast.error(t('zipSkipped', { orders: decodeURIComponent(skipped) }));
      else toast.success(t('zipDone'));
    } catch (e) { toast.error(e instanceof Error ? e.message : 'zip 失敗'); }
    finally { setZipBusy(false); }
  }

  async function applyBulkDate() {
    if (!bulkDate || !selectedOrders.length) return;
    setBulkBusy(true);
    let ok = 0, skipped = 0, failed = 0;
    for (const o of selectedOrders) {
      if (o.type === 'strings') { skipped++; continue; } // orchestra_orders has no estimated_delivery_date
      try { await callUpdateOrder(o.id, o.type, { estimated_delivery_date: bulkDate }); ok++; }
      catch { failed++; }
    }
    await fetchOrders();
    setBulkBusy(false); setSelected(new Set()); setBulkDate('');
    toast.success(t('bulkDateResult', { ok, skipped, failed }));
  }

  return (
    <div className="p-8 min-h-screen text-gray-900">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">{t('title')}</h1>
          <p className="text-gray-600">{t('subtitle')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchOrders}
          className="gap-2 border-gray-400 text-gray-200 hover:text-gray-900 hover:bg-gray-100"
        >
          <RefreshCw className="w-4 h-4" />
          {t('refresh')}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-gray-600 text-sm">{t('totalOrders')}</p>
          <p className="text-2xl font-bold mt-1">{allOrders.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-gray-600 text-sm">{t('inQueue')}</p>
          <p className="text-2xl font-bold text-yellow-700 mt-1">{queueCount}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-gray-600 text-sm">{t('inProduction')}</p>
          <p className="text-2xl font-bold text-orange-700 mt-1">{productionCount}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-gray-600 text-sm">{t('completed')}</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{completedCount}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 w-4 h-4" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white border-gray-300 text-gray-900 placeholder:text-gray-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5 bg-white border border-gray-300 rounded-lg p-1">
            {(['all', 'voice', 'music', 'strings'] as const).map(tp => (
              <button
                key={tp}
                onClick={() => setFilterType(tp)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                  filterType === tp
                    ? tp === 'voice'
                      ? 'bg-cyan-600 text-white'
                      : tp === 'music'
                      ? 'bg-emerald-600 text-white'
                      : tp === 'strings'
                      ? 'bg-amber-600 text-white'
                      : 'bg-gray-300 text-white'
                    : 'text-gray-500 hover:text-white'
                }`}
              >
                {tp === 'all' ? t('allTypes') : tp === 'voice' ? t('typeVoice') : tp === 'music' ? t('typeMusic') : t('typeStrings')}
              </button>
            ))}
          </div>
          <div className="w-px h-5 bg-gray-200" />
          <div className="flex gap-1.5 flex-wrap">
            {([
              { val: 'all', labelKey: 'statusAll', color: 'bg-gray-300' },
              { val: 'paid', labelKey: 'statusInQueue', color: 'bg-yellow-600' },
              { val: 'awaiting_files', labelKey: 'statusAwaitingFiles', color: 'bg-amber-700' },
              { val: 'in_production', labelKey: 'statusInProduction', color: 'bg-orange-600' },
              { val: 'demo_ready', labelKey: 'statusDemoReady', color: 'bg-blue-600' },
              { val: 'delivered', labelKey: 'statusDelivered', color: 'bg-purple-600' },
              { val: 'revising', labelKey: 'statusRevising', color: 'bg-amber-600' },
              { val: 'completed', labelKey: 'statusComplete', color: 'bg-green-600' },
              { val: 'pending_payment', labelKey: 'statusPending', color: 'bg-gray-400' },
            ] as { val: StatusFilter; labelKey: string; color: string }[]).map(({ val, labelKey, color }) => (
              <button
                key={val}
                onClick={() => setFilterStatus(val)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all border ${
                  filterStatus === val
                    ? `${color} text-white border-transparent`
                    : 'border-gray-400 text-gray-700 hover:text-gray-900 hover:border-gray-500'
                }`}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {updateError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {updateError}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-3 text-sm">
          <label className="flex items-center gap-2 text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} className="w-4 h-4 accent-cyan-600" />
            {t('selectAll', { count: filtered.length })}
          </label>
          {selected.size > 0 && (
            <>
              <span className="text-gray-700 font-medium">{t('selectedCount', { count: selected.size })}</span>
              <button onClick={exportCsv} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"><Download className="w-3.5 h-3.5" /> {t('exportCsv')}</button>
              <button onClick={downloadDeliveries} disabled={zipBusy} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 transition-colors"><Download className="w-3.5 h-3.5" /> {zipBusy ? t('zipBusy') : t('zipDeliveries')}</button>
              <span className="inline-flex items-center gap-1.5">
                <input type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900" />
                <button onClick={applyBulkDate} disabled={!bulkDate || bulkBusy} className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50">{bulkBusy ? '…' : t('setEstDelivery')}</button>
              </span>
              <button onClick={() => setSelected(new Set())} className="text-gray-500 hover:text-gray-700">{t('clear')}</button>
            </>
          )}
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-16 text-gray-600 bg-white border border-gray-200 rounded-xl">{t('loadingOrders')}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-600 bg-white border border-gray-200 rounded-xl">{t('noOrders')}</div>
        ) : (
          filtered.map(order => {
            const isExpanded = expandedId === order.id;
            const isVoice = order.type === 'voice';
            const isStrings = order.type === 'strings';
            const isMusic = order.type === 'music';
            const vo = isVoice ? (order as VoiceOrder) : null;
            const mo = isMusic ? (order as MusicOrder) : null;
            const so = isStrings ? (order as StringsOrder) : null;

            return (
              <div key={`${order.type}-${order.id}`} className={`border rounded-xl overflow-hidden transition-colors ${isExpanded ? 'bg-white border-gray-400' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                <div
                  className="flex items-center gap-3 px-4 py-3.5 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                >
                  {/* Bulk-select checkbox (doesn't toggle the row) */}
                  <input type="checkbox" checked={selected.has(order.id)} onClick={e => e.stopPropagation()} onChange={() => toggleSelect(order.id)} className="flex-shrink-0 w-4 h-4 accent-cyan-600" />

                  {/* Type pill */}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${isVoice ? 'bg-cyan-50 text-cyan-700' : isStrings ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {isVoice ? <Mic className="w-3 h-3" /> : isStrings ? <Music2 className="w-3 h-3" /> : <Music className="w-3 h-3" />}
                    {isVoice ? t('pillVoice') : isStrings ? t('pillStrings') : t('pillMusic')}
                  </span>

                  {/* Order # + email stacked */}
                  <div className="flex flex-col min-w-0 w-48 flex-shrink-0">
                    <span className="font-mono text-sm font-semibold text-gray-900 leading-tight">#{order.order_number}</span>
                    <span className="text-xs text-gray-500 truncate leading-tight mt-0.5">{order.email}</span>
                  </div>

                  {/* Plan / Vibe */}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm text-gray-900 font-medium truncate leading-tight">
                      {isVoice ? (vo?.project_name || vo?.voice_selection || t('dash')) : isStrings ? (so?.project_name || t('dash')) : (mo?.vibe || t('dash'))}
                    </span>
                    <span className="text-xs text-gray-500 truncate leading-tight mt-0.5">
                      {isVoice ? getVoiceTierLabel(order.tier) : isStrings ? `${so?.tier_name || t('dash')} · ${t('durationMin', { min: so?.duration_minutes ?? 0 })}` : getMusicTierLabel(order.tier)}
                    </span>
                  </div>

                  {/* Price — show the order's currency so TWD isn't mistaken for USD */}
                  {(() => {
                    const sym = currencySymbol((order as { currency?: string }).currency);
                    return (
                      <span className="text-sm font-bold text-gray-900 flex-shrink-0 w-24 text-right">
                        {sym}{Number(order.price).toLocaleString()}
                      </span>
                    );
                  })()}

                  {/* Status badge */}
                  <div className="flex-shrink-0 w-36 flex justify-end">
                    {getStatusBadge(order.status, t)}
                  </div>

                  {/* Date */}
                  <span className="text-xs text-gray-500 hidden lg:block flex-shrink-0 w-20 text-right">
                    {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>

                  <ChevronRight className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-200 px-5 py-5 space-y-5 bg-white/50">
                    {isVoice && vo && (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('fieldPlan')}</p>
                            <p className="text-gray-200">{getVoiceTierLabel(vo.tier)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('fieldVoice')}</p>
                            <p className="text-gray-200">{vo.voice_selection || t('dash')}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('fieldUseCase')}</p>
                            <p className="text-gray-200">{vo.use_case || t('dash')}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('fieldRightsLevel')}</p>
                            <p className="text-gray-200">{vo.rights_level === 'global' ? t('rightsGlobalShort') : vo.rights_level === 'broadcast' ? t('rightsBroadcastShort') : vo.broadcast_rights ? t('rightsBroadcastLegacy') : t('rightsStandard')}</p>
                          </div>
                        </div>

                        {vo.script_text && (
                          <CollapsibleText text={vo.script_text} label={t('fieldScript')} mono />
                        )}
                      </>
                    )}

                    {isMusic && mo && (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('fieldVibeGenre')}</p>
                            <p className="text-gray-200">{mo.vibe || t('dash')}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('fieldPlan')}</p>
                            <p className="text-gray-200">{getMusicTierLabel(mo.tier) || t('dash')}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('fieldUsageType')}</p>
                            <p className="text-gray-200">{mo.usage_type || t('dash')}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('fieldStringAddon')}</p>
                            <p className="text-gray-200">{mo.string_addon || t('addonNone')}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('fieldRightsLevel')}</p>
                            <p className={`font-medium ${
                              mo.tier === 'masterpiece' ? 'text-emerald-700' :
                              mo.tier === 'pro-arrangement' ? 'text-blue-700' : 'text-gray-200'
                            }`}>{rightsLevelLabel(deriveRightsLevel(mo as unknown as AnyOrder), t)}</p>
                          </div>
                          {mo.talent_name && (
                            <div className="col-span-2 md:col-span-4">
                              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('fieldSingerTalent')}</p>
                              <p className="text-emerald-700 font-medium">{mo.talent_name}</p>
                            </div>
                          )}
                        </div>

                        {mo.description && (
                          <CollapsibleText text={mo.description} label={t('fieldBriefDescription')} />
                        )}

                        {mo.reference_link && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{t('fieldReferenceSonic')}</p>
                            <a
                              href={mo.reference_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-700 transition-colors break-all"
                            >
                              <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                              {mo.reference_link}
                            </a>
                          </div>
                        )}
                      </>
                    )}

                    {isVoice && vo && (
                      <VoiceOrderWorkflow
                        order={{
                          ...vo,
                          order_number: String(vo.order_number),
                          revision_count: vo.revision_count ?? 0,
                          max_revisions: vo.max_revisions ?? 2,
                        }}
                        onStatusChange={fetchOrders}
                      />
                    )}

                    {isMusic && mo && (
                      <MusicOrderWorkflow
                        order={{ ...mo, version_count: mo.version_count || 0, max_versions: mo.max_versions ?? 1 }}
                        onStatusChange={fetchOrders}
                      />
                    )}

                    {isStrings && so && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('fieldSetup')}</p>
                            <p className="text-gray-200">{so.tier_name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('fieldDuration')}</p>
                            <p className="text-gray-200">{t('durationMin', { min: so.duration_minutes })}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('fieldUsage')}</p>
                            <p className="text-gray-200">{so.usage_type || t('dash')}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('fieldGenre')}</p>
                            <p className="text-gray-200">{so.genre || t('dash')}</p>
                          </div>
                        </div>
                        {so.description && (
                          <CollapsibleText text={so.description} label={t('fieldBrief')} />
                        )}
                        <OrchestraOrderWorkflow
                          order={so as any}
                          onRefresh={fetchOrders}
                        />
                      </div>
                    )}

                    {/* Certificate Section - shown for all completed/delivered orders */}
                    {['completed', 'delivered', 'awaiting_final'].includes(order.status) && (
                      <CertificateSection order={order} />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
