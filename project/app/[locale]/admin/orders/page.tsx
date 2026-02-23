'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, RefreshCw, ChevronRight, Play, Music, Mic, ExternalLink, Music2, ChevronDown, ChevronUp, Award, Loader2, Send, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import MusicOrderWorkflow from '@/components/admin/MusicOrderWorkflow';
import VoiceOrderWorkflow from '@/components/admin/VoiceOrderWorkflow';
import OrchestraOrderWorkflow from '@/components/admin/OrchestraOrderWorkflow';
import { getVoiceTierLabel, getMusicTierLabel } from '@/lib/config/pricing.config';

const PREVIEW_LINES = 5;

function CollapsibleText({ text, label, mono }: { text: string; label: string; mono?: boolean }) {
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
            className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            {expanded ? (
              <><ChevronUp className="w-3.5 h-3.5" /> Collapse</>
            ) : (
              <><ChevronDown className="w-3.5 h-3.5" /> Show all ({lines.length} lines)</>
            )}
          </button>
        )}
      </div>
      <div className={`relative bg-zinc-900 rounded-lg px-4 py-3 ${!expanded && needsCollapse ? 'max-h-[7.5rem] overflow-hidden' : ''}`}>
        <p className={`text-gray-300 text-sm leading-relaxed whitespace-pre-wrap break-words ${mono ? 'font-mono' : ''}`}>
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

function getStatusBadge(status: string) {
  switch (status) {
    case 'paid':
      return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20 whitespace-nowrap">In Queue</Badge>;
    case 'processing':
    case 'in_production':
      return <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/20 whitespace-nowrap">In Production</Badge>;
    case 'demo_ready':
      return <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 whitespace-nowrap">Demo Ready</Badge>;
    case 'client_reviewing':
      return <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 whitespace-nowrap">Client Reviewing</Badge>;
    case 'revising':
      return <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 whitespace-nowrap">Revising</Badge>;
    case 'delivered':
      return <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20 whitespace-nowrap">Delivered</Badge>;
    case 'awaiting_final':
      return <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/20 whitespace-nowrap">Awaiting Final</Badge>;
    case 'completed':
      return <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20 whitespace-nowrap">Complete</Badge>;
    case 'pending_payment':
      return <Badge variant="outline" className="bg-zinc-500/10 text-zinc-400 border-zinc-500/20 whitespace-nowrap">Pending Payment</Badge>;
    default:
      return <Badge variant="outline" className="bg-zinc-500/10 text-zinc-400 border-zinc-500/20 whitespace-nowrap">{status}</Badge>;
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
  if (order.type === 'strings' || order.type === 'orchestra') return 'global';
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

function rightsLevelLabel(level: string): string {
  if (level === 'global') return 'Global TV & Game Rights (Full IP Buyout)';
  if (level === 'broadcast') return 'Broadcast TV & Full Media Buyout';
  return 'Standard Commercial';
}

function CertificateSection({ order }: { order: AnyOrder }) {
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
        toast.error(data.error || 'Failed to generate certificate');
      }
    } catch {
      setCertState('idle');
      toast.error('Failed to generate certificate');
    }
  };

  if (certState === 'loading') return null;

  if (certState === 'exists' && cert) {
    return (
      <div className="flex items-center gap-3 p-3 bg-green-500/5 border border-green-500/20 rounded-xl">
        <Award className="w-5 h-5 text-green-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-green-400 font-mono text-sm font-medium">#{cert.license_id}</p>
          <p className="text-gray-500 text-xs">Certificate issued</p>
        </div>
        <a href={cert.pdf_url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-lg text-xs transition-colors">
          <Download className="w-3 h-3" /> PDF
        </a>
        <a href={`/verify/${cert.license_id}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-gray-300 rounded-lg text-xs transition-colors">
          <ExternalLink className="w-3 h-3" /> Verify
        </a>
      </div>
    );
  }

  return (
    <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-3">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Award className="w-4 h-4" />
        <span className="font-medium">Generate License Certificate</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Project Name</label>
          <input
            type="text"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            placeholder={`Order #${order.order_number}`}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-zinc-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Rights Level (Auto)</label>
          <div className={`w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm font-medium ${
            autoRights === 'global' ? 'text-emerald-400' : autoRights === 'broadcast' ? 'text-blue-400' : 'text-gray-300'
          }`}>
            {rightsLevelLabel(autoRights)}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
          <input type="checkbox" checked={sendToClient} onChange={e => setSendToClient(e.target.checked)}
            className="rounded border-zinc-600" />
          Email certificate to client
        </label>
        <button
          onClick={generate}
          disabled={certState === 'generating'}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {certState === 'generating' ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</>
          ) : (
            <><Award className="w-3.5 h-3.5" /> Generate Certificate</>
          )}
        </button>
      </div>
    </div>
  );
}

export default function AdminOrdersPage() {
  const searchParams = useSearchParams();
  const [voiceOrders, setVoiceOrders] = useState<VoiceOrder[]>([]);
  const [musicOrders, setMusicOrders] = useState<MusicOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [filterType, setFilterType] = useState<'all' | 'voice' | 'music' | 'strings'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

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
        fetch('/api/orders/orchestra?all=1').then(r => r.json()).catch(() => []),
      ]);

      if (voiceResult.error) {
        setUpdateError('Failed to load voice orders: ' + voiceResult.error.message);
      }
      if (musicResult.error) {
        setUpdateError('Failed to load music orders: ' + musicResult.error.message);
      }

      setVoiceOrders((voiceResult.data || []).map(o => ({ ...o, revision_count: o.revision_count ?? 0, max_revisions: o.max_revisions ?? 2, type: 'voice' as const })));
      setMusicOrders((musicResult.data || []).map(o => {
        const raw = o as typeof o & { talents?: { name: string } | null };
        return { ...o, talent_name: raw.talents?.name ?? null, type: 'music' as const };
      }));
      const stringsData = Array.isArray(strings) ? strings : [];
      setStringsOrders(stringsData.map((o: any) => ({ ...o, type: 'strings' as const })));
    } catch (err) {
      console.error('Error fetching orders:', err);
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
    const matchesSearch =
      order.email.toLowerCase().includes(term) ||
      String(order.order_number).toLowerCase().includes(term);
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const matchesType = filterType === 'all' || order.type === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  const queueCount = allOrders.filter(o => o.status === 'paid').length;
  const productionCount = allOrders.filter(o => ['processing', 'in_production', 'demo_ready', 'client_reviewing', 'revising', 'delivered', 'awaiting_final'].includes(o.status)).length;
  const completedCount = allOrders.filter(o => o.status === 'completed').length;

  return (
    <div className="p-8 min-h-screen text-white">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Order Management</h1>
          <p className="text-gray-400">Manage and deliver all voice, music, and strings orders</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchOrders}
          className="gap-2 border-zinc-600 text-gray-200 hover:text-white hover:bg-zinc-800"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-gray-400 text-sm">Total Orders</p>
          <p className="text-2xl font-bold mt-1">{allOrders.length}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-gray-400 text-sm">In Queue</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">{queueCount}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-gray-400 text-sm">In Production</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">{productionCount}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-gray-400 text-sm">Completed</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{completedCount}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search by email or order number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5 bg-zinc-900 border border-zinc-700 rounded-lg p-1">
            {(['all', 'voice', 'music', 'strings'] as const).map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                  filterType === t
                    ? t === 'voice'
                      ? 'bg-cyan-600 text-white'
                      : t === 'music'
                      ? 'bg-emerald-600 text-white'
                      : t === 'strings'
                      ? 'bg-amber-600 text-white'
                      : 'bg-zinc-600 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {t === 'all' ? 'All Types' : t === 'voice' ? 'Voice' : t === 'music' ? 'Music' : 'Strings'}
              </button>
            ))}
          </div>
          <div className="w-px h-5 bg-zinc-700" />
          <div className="flex gap-1.5 flex-wrap">
            {([
              { val: 'all', label: 'All', color: 'bg-zinc-600' },
              { val: 'paid', label: 'In Queue', color: 'bg-yellow-600' },
              { val: 'awaiting_files', label: 'Awaiting Files', color: 'bg-amber-700' },
              { val: 'in_production', label: 'In Production', color: 'bg-orange-600' },
              { val: 'demo_ready', label: 'Demo Ready', color: 'bg-blue-600' },
              { val: 'delivered', label: 'Delivered', color: 'bg-purple-600' },
              { val: 'revising', label: 'Revising', color: 'bg-amber-600' },
              { val: 'completed', label: 'Complete', color: 'bg-green-600' },
              { val: 'pending_payment', label: 'Pending', color: 'bg-zinc-500' },
            ] as { val: StatusFilter; label: string; color: string }[]).map(({ val, label, color }) => (
              <button
                key={val}
                onClick={() => setFilterStatus(val)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all border ${
                  filterStatus === val
                    ? `${color} text-white border-transparent`
                    : 'border-zinc-600 text-zinc-300 hover:text-white hover:border-zinc-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {updateError && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {updateError}
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-16 text-gray-400 bg-zinc-900 border border-zinc-800 rounded-xl">Loading orders...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 bg-zinc-900 border border-zinc-800 rounded-xl">No orders found.</div>
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
              <div key={`${order.type}-${order.id}`} className={`border rounded-xl overflow-hidden transition-colors ${isExpanded ? 'bg-zinc-900 border-zinc-600' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}`}>
                <div
                  className="flex items-center gap-3 px-4 py-3.5 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                >
                  {/* Type pill */}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${isVoice ? 'bg-cyan-500/15 text-cyan-400' : isStrings ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                    {isVoice ? <Mic className="w-3 h-3" /> : isStrings ? <Music2 className="w-3 h-3" /> : <Music className="w-3 h-3" />}
                    {isVoice ? 'Voice' : isStrings ? 'Strings' : 'Music'}
                  </span>

                  {/* Order # + email stacked */}
                  <div className="flex flex-col min-w-0 w-48 flex-shrink-0">
                    <span className="font-mono text-sm font-semibold text-white leading-tight">#{order.order_number}</span>
                    <span className="text-xs text-zinc-400 truncate leading-tight mt-0.5">{order.email}</span>
                  </div>

                  {/* Plan / Vibe */}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm text-white font-medium truncate leading-tight">
                      {isVoice ? (vo?.project_name || vo?.voice_selection || '—') : isStrings ? (so?.project_name || '—') : (mo?.vibe || '—')}
                    </span>
                    <span className="text-xs text-zinc-500 truncate leading-tight mt-0.5">
                      {isVoice ? getVoiceTierLabel(order.tier) : isStrings ? `${so?.tier_name || '—'} · ${so?.duration_minutes}min` : getMusicTierLabel(order.tier)}
                    </span>
                  </div>

                  {/* Price */}
                  <span className="text-sm font-bold text-white flex-shrink-0 w-20 text-right">
                    ${Number(order.price).toLocaleString()}
                  </span>

                  {/* Status badge */}
                  <div className="flex-shrink-0 w-36 flex justify-end">
                    {getStatusBadge(order.status)}
                  </div>

                  {/* Date */}
                  <span className="text-xs text-zinc-500 hidden lg:block flex-shrink-0 w-20 text-right">
                    {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>

                  <ChevronRight className={`w-4 h-4 text-zinc-500 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                </div>

                {isExpanded && (
                  <div className="border-t border-zinc-800 px-5 py-5 space-y-5 bg-zinc-950/50">
                    {isVoice && vo && (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Plan</p>
                            <p className="text-gray-200">{getVoiceTierLabel(vo.tier)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Voice</p>
                            <p className="text-gray-200">{vo.voice_selection || '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Use Case</p>
                            <p className="text-gray-200">{vo.use_case || '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Rights Level</p>
                            <p className="text-gray-200">{vo.rights_level === 'global' ? 'Global TV & Game Rights' : vo.rights_level === 'broadcast' ? 'Broadcast TV & Buyout' : vo.broadcast_rights ? 'Broadcast (Legacy)' : 'Standard Commercial'}</p>
                          </div>
                        </div>

                        {vo.script_text && (
                          <CollapsibleText text={vo.script_text} label="Script" mono />
                        )}
                      </>
                    )}

                    {isMusic && mo && (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Vibe / Genre</p>
                            <p className="text-gray-200">{mo.vibe || '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Plan</p>
                            <p className="text-gray-200">{getMusicTierLabel(mo.tier) || '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Usage Type</p>
                            <p className="text-gray-200">{mo.usage_type || '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">String Addon</p>
                            <p className="text-gray-200">{mo.string_addon || 'None'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Rights Level</p>
                            <p className={`font-medium ${
                              mo.tier === 'masterpiece' ? 'text-emerald-400' :
                              mo.tier === 'pro-arrangement' ? 'text-blue-400' : 'text-gray-200'
                            }`}>{rightsLevelLabel(deriveRightsLevel(mo as unknown as AnyOrder))}</p>
                          </div>
                          {mo.talent_name && (
                            <div className="col-span-2 md:col-span-4">
                              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Singer / Talent</p>
                              <p className="text-emerald-300 font-medium">{mo.talent_name}</p>
                            </div>
                          )}
                        </div>

                        {mo.description && (
                          <CollapsibleText text={mo.description} label="Brief / Description" />
                        )}

                        {mo.reference_link && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Reference / Sonic Ref</p>
                            <a
                              href={mo.reference_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors break-all"
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
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Setup</p>
                            <p className="text-gray-200">{so.tier_name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Duration</p>
                            <p className="text-gray-200">{so.duration_minutes} min</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Usage</p>
                            <p className="text-gray-200">{so.usage_type || '—'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Genre</p>
                            <p className="text-gray-200">{so.genre || '—'}</p>
                          </div>
                        </div>
                        {so.description && (
                          <CollapsibleText text={so.description} label="Brief" />
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
