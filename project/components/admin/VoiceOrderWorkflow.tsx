'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { mediaToMp3, needsMp3Convert } from '@/lib/media-to-mp3';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload, Play, CheckCircle2, Loader2, Trash2,
  Send, FileAudio, RefreshCw, Lock, Plus, X, Mic,
  UserPlus, User, CalendarClock, Download,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Supabase 公開網址加 ?download=<檔名> 會回 Content-Disposition: attachment,瀏覽器直接下載
const downloadUrl = (url: string, name: string) =>
  `${url}${url.includes('?') ? '&' : '?'}download=${encodeURIComponent(name)}`;

interface Version {
  id: string;
  file_url: string;
  file_name: string;
  notes: string;
  version_number: number;
  client_feedback: string;
  status: string;
  created_at: string;
}

interface Deliverable {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  label: string;
  sort_order: number;
}

interface VoiceOrder {
  id: string;
  order_number: string;
  email: string;
  status: string;
  tier: string;
  revision_count: number;
  max_revisions: number;
  project_name?: string;
  talent_id?: string | null;
  price?: number;
  voice_selection?: string;
  estimated_delivery_date?: string | null;
}

interface Props {
  order: VoiceOrder;
  onStatusChange: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Awaiting Payment',
  paid: 'In Queue',
  in_production: 'In Production',
  delivered: 'Delivered — Awaiting Review',
  awaiting_final: 'Awaiting Final Upload',
  completed: 'Completed',
};

const REVISION_LABELS: Record<string, string> = {
  'tier-1': 'AI Retakes',
  'tier-2': 'Director Revisions',
  'tier-3': 'Performance Pickups',
};

function sanitizePath(rawPath: string): string {
  return rawPath.replace(/[^a-zA-Z0-9._\-/]/g, '_');
}

async function uploadFile(file: File, path: string): Promise<string> {
  const safePath = sanitizePath(path);
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { error } = await client.storage.from('deliverables').upload(safePath, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: true,
  });
  if (error) throw new Error(error.message);
  const { data } = client.storage.from('deliverables').getPublicUrl(safePath);
  return data.publicUrl;
}

async function updateVoiceOrderStatus(orderId: string, status: string, extra?: Record<string, unknown>) {
  const res = await fetch('/api/admin/orders', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, orderType: 'voice', updates: { status, ...extra } }),
  });
  if (!res.ok) {
    const d = await res.json();
    throw new Error(d.error || 'Failed to update');
  }
}

// Save the estimated delivery date WITHOUT a status change (so it doesn't fire a
// client workflow email — that only happens when `status` is in the update).
async function saveVoiceEstimatedDate(orderId: string, date: string) {
  const res = await fetch('/api/admin/orders', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, orderType: 'voice', updates: { estimated_delivery_date: date || null } }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || 'Failed to save date');
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Assign a talent to an order via the service-role admin API (browser/anon writes
// to voice_orders are RLS-blocked → would silently no-op).
async function assignOrderTalent(orderId: string, talentId: string) {
  const res = await fetch('/api/admin/orders', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
    body: JSON.stringify({ orderId, orderType: 'voice', updates: { talent_id: talentId } }),
  });
  if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Failed to assign talent'); }
}

export default function VoiceOrderWorkflow({ order, onStatusChange }: Props) {
  const { toast } = useToast();
  const [versions, setVersions] = useState<Version[]>([]);
  // 客戶修改需求(2026-07-20 Wing:在訂單頁驗收就在訂單頁發修改)
  const [revOpen, setRevOpen] = useState(false);
  const [revNote, setRevNote] = useState('');
  const [revFiles, setRevFiles] = useState<{ name: string; url: string }[]>([]);
  const [revBusy, setRevBusy] = useState(false);
  async function uploadRevFile(raw: File) {
    try {
      // 音檔/影片自動轉 mp3(WAV 直傳太肥常逾時 —— Wing 2026-07-21 實測上傳失敗的根因)
      let file = raw;
      if (needsMp3Convert(raw)) file = await mediaToMp3(raw);
      const u = await fetch('/api/admin/casting/upload', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name }),
      });
      const uj = await u.json().catch(() => ({}));
      if (!u.ok || !uj.path || !uj.token) throw new Error(uj.error || '上傳準備失敗');
      const { error: upErr } = await supabase.storage.from('casting').uploadToSignedUrl(uj.path, uj.token, file);
      if (upErr) throw new Error(upErr.message);
      setRevFiles((s) => [...s, { name: file.name, url: uj.publicUrl }]);
    } catch (e) { alert(e instanceof Error ? e.message : '上傳失敗'); }
  }
  async function sendRevision() {
    if (!revNote.trim() && !revFiles.length) { alert('請填修改說明或上傳參考檔'); return; }
    setRevBusy(true);
    const res = await fetch('/api/admin/casting/revision', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: order.id, note: revNote.trim(), files: revFiles }),
    });
    setRevBusy(false);
    if (!res.ok) { alert((await res.json().catch(() => ({}))).error || '發送失敗'); return; }
    setRevOpen(false); setRevNote(''); setRevFiles([]);
    onStatusChange?.();
  }
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [estDate, setEstDate] = useState(order.estimated_delivery_date || '');
  const [savingDate, setSavingDate] = useState(false);
  const [dateSaved, setDateSaved] = useState(false);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingNotes, setPendingNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const [pendingDelivFile, setPendingDelivFile] = useState<File | null>(null);
  const [pendingDelivLabel, setPendingDelivLabel] = useState('');
  const [uploadingDeliv, setUploadingDeliv] = useState(false);
  const [delivProgress, setDelivProgress] = useState(0);
  const [delivStatus, setDelivStatus] = useState('');
  const [delivSuccess, setDelivSuccess] = useState(false);
  const [delivError, setDelivError] = useState('');

  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [talentList, setTalentList] = useState<{ id: string; name: string; email: string }[]>([]);
  const [assignedTalent, setAssignedTalent] = useState<string>(order.talent_id || '');
  const [assigningTalent, setAssigningTalent] = useState(false);

  const versionFileRef = useRef<HTMLInputElement>(null);
  const delivFileRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [vRes, dRes] = await Promise.all([
        supabase.from('voice_order_versions').select('*').eq('voice_order_id', order.id).order('version_number', { ascending: true }),
        supabase.from('voice_order_deliverables').select('*').eq('voice_order_id', order.id).order('sort_order', { ascending: true }),
      ]);
      if (vRes.error) console.error('Failed to load versions:', vRes.error.message);
      if (dRes.error) console.error('Failed to load deliverables:', dRes.error.message);
      setVersions(vRes.data || []);
      setDeliverables(dRes.data || []);
    } catch (err) {
      console.error('Failed to fetch order data:', err);
    } finally {
      setLoadingData(false);
    }
  }, [order.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (order.tier !== 'tier-3') return;
    async function loadTalents() {
      // Via the admin service-role API (not the public anon key) so talent email
      // isn't exposed publicly. Admin auth cookie rides the same-origin fetch.
      const res = await fetch('/api/admin/talents');
      if (!res.ok) return;
      const all = (await res.json()) as Array<{ id: string; name: string; email: string | null; is_active: boolean; type: string }>;
      const list = (Array.isArray(all) ? all : [])
        .filter((t) => t.is_active && ['voice_actor', 'VO', 'Singer'].includes(t.type))
        .map((t) => ({ id: t.id, name: t.name, email: t.email || '' }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setTalentList(list);
    }
    loadTalents();
  }, [order.tier]);

  const handleAssignTalent = async (talentId: string) => {
    if (!talentId) return;
    setAssigningTalent(true);
    try {
      await assignOrderTalent(order.id, talentId);
      setAssignedTalent(talentId);
      toast({ title: 'Talent assigned', description: `Talent has been assigned to this order.` });
      onStatusChange();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to assign talent', variant: 'destructive' });
    } finally {
      setAssigningTalent(false);
    }
  };

  const handleStartProduction = async () => {
    setUpdatingStatus(true);
    try {
      await updateVoiceOrderStatus(order.id, 'in_production');
      toast({ title: 'Production started' });
      onStatusChange();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleUploadVersion = async () => {
    if (!pendingFile) return;
    if (!pendingNotes.trim()) {
      setUploadError('Please add a note to the client before delivering.');
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    setUploadSuccess(false);
    setUploadError('');

    try {
      const nextNum = versions.length + 1;
      setUploadStatus(`Uploading ${pendingFile.name}...`);
      setUploadProgress(20);

      const filePath = `voice-versions/${order.id}/${Date.now()}-${pendingFile.name}`;
      const publicUrl = await uploadFile(pendingFile, filePath);
      setUploadProgress(60);
      setUploadStatus('Saving to database...');

      const { error: insertErr } = await supabase.from('voice_order_versions').insert({
        voice_order_id: order.id,
        file_url: publicUrl,
        file_name: pendingFile.name,
        notes: pendingNotes,
        version_number: nextNum,
        status: 'pending_review',
      });
      if (insertErr) {
        console.error('voice_order_versions insert error:', insertErr);
        throw new Error(`Database error: ${insertErr.message}. Have you created the voice_order_versions table?`);
      }
      setUploadProgress(80);
      setUploadStatus('Updating order status...');

      const newRevisionCount = (order.revision_count || 0) + (nextNum > 1 ? 1 : 0);
      await updateVoiceOrderStatus(order.id, 'delivered', {
        revision_count: newRevisionCount,
      });
      setUploadProgress(100);
      setUploadStatus('');

      // Notify client that version is ready for review
      try {
        await fetch('/api/mail/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflow: 'voice',
            type: 'version_delivered',
            email: order.email,
            orderNumber: order.order_number,
            orderId: order.id,
            category: 'PRODUCTION',
            versionNumber: nextNum,
          }),
        });
      } catch { /* silent */ }

      setPendingFile(null);
      setPendingNotes('');
      setUploadSuccess(true);
      toast({ title: `Version ${nextNum} delivered`, description: 'Client has been notified.' });
      fetchData();
      onStatusChange();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      console.error('Voice version upload error:', err);
      setUploadError(msg);
      setUploadStatus('');
      setUploadProgress(0);
      toast({ title: 'Upload failed', description: msg, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    try {
      await supabase.from('voice_order_versions').delete().eq('id', versionId);
      fetchData();
      toast({ title: 'Version removed' });
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Delete failed', variant: 'destructive' });
    }
  };

  const handleUploadDeliverable = async () => {
    if (!pendingDelivFile) return;
    setUploadingDeliv(true);
    setDelivProgress(0);
    setDelivSuccess(false);
    setDelivError('');

    try {
      setDelivStatus(`Uploading ${pendingDelivFile.name}...`);
      setDelivProgress(30);

      const filePath = `voice-finals/${order.id}/${Date.now()}-${pendingDelivFile.name}`;
      const publicUrl = await uploadFile(pendingDelivFile, filePath);
      setDelivProgress(70);
      setDelivStatus('Saving to database...');

      const ext = pendingDelivFile.name.split('.').pop()?.toLowerCase() || 'wav';
      const { error: insertErr } = await supabase.from('voice_order_deliverables').insert({
        voice_order_id: order.id,
        file_url: publicUrl,
        file_name: pendingDelivFile.name,
        file_type: ext,
        label: pendingDelivLabel || pendingDelivFile.name.replace(/\.[^.]+$/, ''),
        sort_order: deliverables.length,
      });
      if (insertErr) {
        console.error('voice_order_deliverables insert error:', insertErr);
        throw new Error(`Database error: ${insertErr.message}. Have you created the voice_order_deliverables table?`);
      }

      setDelivProgress(100);
      setDelivStatus('');
      setPendingDelivFile(null);
      setPendingDelivLabel('');
      setDelivSuccess(true);
      toast({ title: 'Deliverable uploaded' });
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      console.error('Voice deliverable upload error:', err);
      setDelivError(msg);
      setDelivStatus('');
      setDelivProgress(0);
      toast({ title: 'Upload failed', description: msg, variant: 'destructive' });
    } finally {
      setUploadingDeliv(false);
    }
  };

  const handleDeleteDeliverable = async (delivId: string) => {
    try {
      await supabase.from('voice_order_deliverables').delete().eq('id', delivId);
      fetchData();
      toast({ title: 'File removed' });
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Delete failed', variant: 'destructive' });
    }
  };

  const handleMarkComplete = async () => {
    if (deliverables.length === 0) {
      toast({ title: 'No deliverables', description: 'Upload at least one final file first.', variant: 'destructive' });
      return;
    }
    setUpdatingStatus(true);
    try {
      await updateVoiceOrderStatus(order.id, 'completed');

      try {
        await fetch('/api/mail/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflow: 'voice',
            type: 'final_ready',
            email: order.email,
            orderNumber: order.order_number,
            orderId: order.id,
            category: 'PRODUCTION',
          }),
        });
      } catch { /* silent */ }

      if (order.tier === 'tier-3') {
        try {
          await fetch('/api/admin/certificates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: order.id,
              orderNumber: String(order.order_number),
              orderType: 'voice',
              tier: 'tier-3',
              rightsLevel: 'global',
              clientEmail: order.email,
              projectName: order.project_name || `Order #${order.order_number}`,
              talentId: order.talent_id || null,
              sendToClient: true,
            }),
          });
          toast({ title: 'Order completed', description: 'License Certificate auto-generated and sent to client.' });
        } catch {
          toast({ title: 'Order completed', description: 'Client notified. Certificate generation failed — please generate manually.' });
        }
      } else {
        toast({ title: 'Order completed', description: 'Client notified by email.' });
      }

      if (order.tier !== 'tier-3' && order.price) {
        let resolvedTalentId = order.talent_id || '';
        if (!resolvedTalentId && order.voice_selection) {
          const { data: matched } = await supabase
            .from('talents')
            .select('id')
            .ilike('name', `%${order.voice_selection.split('(')[0].trim()}%`)
            .eq('is_active', true)
            .limit(1)
            .single();
          if (matched?.id) {
            resolvedTalentId = matched.id;
            await assignOrderTalent(order.id, matched.id);
          }
        }
        if (resolvedTalentId) {
          try {
            await fetch('/api/admin/earnings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: order.id,
                orderType: 'voice',
                orderNumber: String(order.order_number),
                tier: order.tier,
                talentId: resolvedTalentId,
                orderTotal: order.price,
              }),
            });
          } catch { /* silent — earnings can be added manually */ }
        }
      }

      onStatusChange();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const revisionLabel = REVISION_LABELS[order.tier] || 'Revisions';
  const maxRev = order.max_revisions ?? 2;
  const usedRev = order.revision_count ?? 0;

  const canUploadVersion = ['in_production'].includes(order.status);
  const showFinalSection = ['delivered', 'awaiting_final', 'in_production', 'completed'].includes(order.status);

  if (loadingData) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading workflow...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Status + Revision Counter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Workflow Stage</span>
          <Badge variant="outline" className="border-cyan-500/30 text-cyan-400">
            {STATUS_LABELS[order.status] || order.status}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{revisionLabel}: {usedRev} / {maxRev}</span>
          <button onClick={fetchData} className="hover:text-white transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Talent Assignment */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          {(assignedTalent || order.voice_selection) ? <User className="w-4 h-4 text-emerald-400" /> : <UserPlus className="w-4 h-4 text-amber-400" />}
          <span className="text-sm font-semibold text-gray-300">
            {order.tier === 'tier-3' ? (assignedTalent ? 'Assigned Talent' : 'Assign Talent') : 'Voice Talent'}
          </span>
        </div>

        {order.tier === 'tier-3' ? (
          <div className="flex items-center gap-3">
            <select
              value={assignedTalent}
              onChange={(e) => handleAssignTalent(e.target.value)}
              disabled={assigningTalent}
              className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none disabled:opacity-50"
            >
              <option value="">— Select talent —</option>
              {talentList.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
              ))}
            </select>
            {assigningTalent && <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />}
            {assignedTalent && (
              <Badge className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/40">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Assigned
              </Badge>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-blue-200 font-medium">
              {order.voice_selection || '—'}
            </div>
            <Badge className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/40">
              Client Selected
            </Badge>
          </div>
        )}
      </div>

      {/* Estimated delivery date (no email — just shown to the client) */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <CalendarClock className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-gray-300">預計交期 Estimated delivery</span>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={estDate ? String(estDate).slice(0, 10) : ''}
            onChange={(e) => { setEstDate(e.target.value); setDateSaved(false); }}
            className="bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none" />
          <button
            onClick={async () => {
              setSavingDate(true);
              try { await saveVoiceEstimatedDate(order.id, estDate); setDateSaved(true); }
              catch (e) { toast({ title: e instanceof Error ? e.message : 'Failed', variant: 'destructive' }); }
              finally { setSavingDate(false); }
            }}
            disabled={savingDate}
            className="px-3 py-2 rounded-lg text-sm bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50">
            {savingDate ? '…' : '儲存'}
          </button>
          {dateSaved && <span className="text-xs text-emerald-400">已儲存 ✓</span>}
        </div>
        <p className="text-[11px] text-gray-500 mt-2">客戶會在訂單頁看到這個預計交期(不寄通知信)。</p>
      </div>

      {/* Pending Payment */}
      {order.status === 'pending_payment' && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-amber-300 font-semibold">Awaiting payment — ${order.price?.toLocaleString() || '—'}</p>
            <Badge className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/40">Unpaid</Badge>
          </div>
          <p className="text-xs text-gray-400 mb-3">Client can pay online, or you can manually mark as paid if payment was received offline.</p>
          <Button
            size="sm"
            onClick={async () => {
              if (!confirm('Mark this order as paid? This will move it to the production queue.')) return;
              setUpdatingStatus(true);
              try {
                // Route through the admin API (service role) — a financial change must
                // not rely on the browser anon client, which RLS silently blocks (the
                // update affected 0 rows and looked like nothing happened).
                await updateVoiceOrderStatus(order.id, 'paid', { payment_status: 'completed', paid_at: new Date().toISOString() });
                toast({ title: 'Payment confirmed', description: 'Order moved to production queue.' });
                onStatusChange();
              } catch (err: unknown) {
                toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
              } finally {
                setUpdatingStatus(false);
              }
            }}
            disabled={updatingStatus}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            {updatingStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Confirm Payment Received
          </Button>
        </div>
      )}

      {/* In Queue */}
      {order.status === 'paid' && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-sm text-yellow-300 mb-3">Order paid and waiting. Start production when ready.</p>
          <Button size="sm" onClick={handleStartProduction} disabled={updatingStatus} className="bg-orange-600 hover:bg-orange-700 text-white gap-2">
            {updatingStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Start Production
          </Button>
        </div>
      )}

      {/* Delivered — client feedback info */}
      {order.status === 'delivered' && (
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4 space-y-1">
          <p className="text-sm font-semibold text-cyan-300">Awaiting client review</p>
          <p className="text-xs text-gray-400">Client is reviewing Version {versions.length}. They can approve or request revision.</p>
        </div>
      )}

      {/* Awaiting final — client approved */}
      {order.status === 'awaiting_final' && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-orange-300 font-semibold text-sm">
            <Lock className="w-4 h-4" />
            Client approved — upload final deliverables below
          </div>
          <p className="text-xs text-gray-500">Upload WAV/MP3 below, then click Mark Order as Complete.</p>
        </div>
      )}

      {/* Version History */}
      {versions.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
            <Mic className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-cyan-400">Versions ({versions.length})</span>
            {order.talent_id && (
              <button onClick={() => setRevOpen(!revOpen)}
                className="ml-auto text-[11px] px-2.5 py-1 rounded-full border bg-amber-500/10 text-amber-300 border-amber-400/30 hover:bg-amber-500/20">
                ✏️ 發修改需求{(order.revision_count || 0) > 0 ? `(第 ${order.revision_count} 輪)` : ''}
              </button>
            )}
          </div>
          <div className="divide-y divide-zinc-800">
            {revOpen && (
              <div className="px-4 py-3 border-b border-white/10 bg-amber-500/5">
                <p className="text-xs font-medium text-amber-200 mb-1.5">客戶修改需求 → 單子退回製作中+三路通知配音員</p>
                <textarea value={revNote} onChange={(e) => setRevNote(e.target.value)} rows={3}
                  placeholder="修改說明/客戶評語(哪句、怎麼改)…"
                  className="w-full bg-black/30 border border-white/15 rounded-lg px-3 py-2 text-sm text-white mb-2" />
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {revFiles.map((f, i) => (
                    <span key={i} className="text-xs bg-white/10 border border-white/10 rounded px-2 py-1 text-gray-200">{f.name}
                      <button onClick={() => setRevFiles((s) => s.filter((_, j) => j !== i))} className="ml-1 text-gray-400 hover:text-red-400">✕</button>
                    </span>
                  ))}
                  <label className="text-xs bg-white/10 border border-white/15 rounded-lg px-2.5 py-1 cursor-pointer hover:bg-white/15 text-gray-200">
                    + 加參考檔(音檔/文件)
                    <input type="file" multiple className="hidden" onChange={(e) => { [...(e.target.files || [])].forEach(uploadRevFile); e.target.value = ''; }} />
                  </label>
                </div>
                <div className="flex gap-2">
                  <button onClick={sendRevision} disabled={revBusy}
                    className="text-xs bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg px-3 py-1.5">{revBusy ? '發送中…' : '發出(退回製作中+通知)'}</button>
                  <button onClick={() => setRevOpen(false)} className="text-xs border border-white/20 text-gray-300 rounded-lg px-3 py-1.5 hover:bg-white/10">取消</button>
                </div>
              </div>
            )}
            {versions.map((ver, idx) => {
              const isApproved = ver.status === 'approved';
              const hasRevisionRequest = ver.status === 'revision_requested';
              return (
                <div key={ver.id} className={`px-4 py-3 ${isApproved ? 'bg-green-500/5' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                      isApproved ? 'bg-green-500 text-white' : 'bg-zinc-800'
                    }`}>
                      {isApproved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="text-xs text-gray-500">V{idx + 1}</span>}
                    </div>
                    <FileAudio className={`w-4 h-4 flex-shrink-0 ${isApproved ? 'text-green-400' : 'text-cyan-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm text-gray-200 truncate font-medium">{ver.file_name}</p>
                        {isApproved && (
                          <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/40 gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Approved
                          </Badge>
                        )}
                        {hasRevisionRequest && (
                          <Badge className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/40">
                            Revision Requested
                          </Badge>
                        )}
                      </div>
                      {ver.notes && <p className="text-xs text-gray-500">Admin: {ver.notes}</p>}
                      <p className="text-xs text-gray-600">{new Date(ver.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a href={ver.file_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                        <Play className="w-3 h-3" /> Play
                      </a>
                      <a href={downloadUrl(ver.file_url, ver.file_name)}
                        className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                        <Download className="w-3 h-3" /> 下載
                      </a>
                      <button onClick={() => handleDeleteVersion(ver.id)} className="text-zinc-600 hover:text-red-400 transition-colors p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {ver.client_feedback && (
                    <div className="mt-2 ml-10 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <p className="text-xs text-gray-400 mb-0.5">Client Feedback:</p>
                      <p className="text-sm text-amber-300">{ver.client_feedback}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload New Version */}
      {canUploadVersion && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
            <Send className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-cyan-400">
              {versions.length === 0 ? 'Upload First Delivery' : `Upload Version ${versions.length + 1}`}
            </span>
          </div>
          <div className="p-4 space-y-3">
            {pendingFile && !uploading && (
              <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
                <FileAudio className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{pendingFile.name}</p>
                  <p className="text-xs text-gray-500">{formatBytes(pendingFile.size)}</p>
                </div>
                <input
                  type="text"
                  placeholder="Note to client (required)"
                  value={pendingNotes}
                  onChange={(e) => { setPendingNotes(e.target.value); setUploadError(''); }}
                  className={`w-48 text-xs bg-zinc-700 border rounded px-2 py-1 text-white placeholder:text-gray-500 focus:outline-none h-7 ${!pendingNotes.trim() && uploadError ? 'border-red-500' : 'border-zinc-600'}`}
                />
                <button onClick={() => { setPendingFile(null); setPendingNotes(''); }} className="text-zinc-500 hover:text-red-400 p-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {uploading && (
              <div className="space-y-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-cyan-300 truncate max-w-[70%]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1.5" />
                    {uploadStatus || 'Processing...'}
                  </span>
                  <span className="font-mono font-semibold text-cyan-400">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-2.5">
                  <div className="bg-cyan-500 h-2.5 rounded-full transition-all duration-500 ease-out" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            {uploadSuccess && !uploading && (
              <div className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2.5">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                Version delivered successfully — client has been notified.
              </div>
            )}

            {uploadError && !uploading && (
              <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                <p className="font-semibold mb-1">Upload failed</p>
                <p className="text-xs text-red-300">{uploadError}</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input ref={versionFileRef} type="file" accept=".wav,.mp3,.aiff,.flac" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setPendingFile(f); setUploadSuccess(false); setUploadError(''); }
                e.target.value = '';
              }} className="hidden" />
              <Button size="sm" onClick={() => versionFileRef.current?.click()} disabled={uploading}
                className="bg-zinc-700 hover:bg-zinc-600 text-white gap-2">
                <Plus className="w-3.5 h-3.5" />
                Select File
              </Button>
              {pendingFile && !uploading && (
                <Button size="sm" onClick={handleUploadVersion} className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2">
                  <Upload className="w-3.5 h-3.5" />
                  Deliver V{versions.length + 1}
                </Button>
              )}
            </div>
            <p className="text-xs text-gray-600">Upload the voiceover file. Client will be notified to review.</p>
          </div>
        </div>
      )}

      {/* Final Deliverables */}
      {showFinalSection && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
            <Upload className="w-4 h-4 text-green-400" />
            <span className="text-sm font-semibold text-green-400">Final Deliverables ({deliverables.length})</span>
          </div>

          {deliverables.length > 0 && (
            <div className="divide-y divide-zinc-800">
              {deliverables.map((deliv) => (
                <div key={deliv.id} className="flex items-center gap-3 px-4 py-3">
                  <FileAudio className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 font-medium truncate">{deliv.label || deliv.file_name}</p>
                    <p className="text-xs text-gray-500">{deliv.file_type.toUpperCase()}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a href={deliv.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                      <Play className="w-3 h-3" /> Play
                    </a>
                    <a href={downloadUrl(deliv.file_url, deliv.file_name)} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                      <Download className="w-3 h-3" /> 下載
                    </a>
                    <button onClick={() => handleDeleteDeliverable(deliv.id)} className="text-zinc-600 hover:text-red-400 p-1 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="p-4 space-y-3">
            {pendingDelivFile && !uploadingDeliv && (
              <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
                <FileAudio className="w-4 h-4 text-green-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{pendingDelivFile.name}</p>
                  <p className="text-xs text-gray-500">{formatBytes(pendingDelivFile.size)}</p>
                </div>
                <input
                  type="text"
                  placeholder="Label (optional)"
                  value={pendingDelivLabel}
                  onChange={(e) => setPendingDelivLabel(e.target.value)}
                  className="w-36 text-xs bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-white placeholder:text-gray-500 focus:outline-none h-7"
                />
                <button onClick={() => { setPendingDelivFile(null); setPendingDelivLabel(''); }} className="text-zinc-500 hover:text-red-400 p-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {uploadingDeliv && (
              <div className="space-y-2 bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-green-300 truncate max-w-[70%]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1.5" />
                    {delivStatus || 'Processing...'}
                  </span>
                  <span className="font-mono font-semibold text-green-400">{delivProgress}%</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-2.5">
                  <div className="bg-green-500 h-2.5 rounded-full transition-all duration-500 ease-out" style={{ width: `${delivProgress}%` }} />
                </div>
              </div>
            )}

            {delivSuccess && !uploadingDeliv && (
              <div className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2.5">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                Deliverable uploaded successfully.
              </div>
            )}

            {delivError && !uploadingDeliv && (
              <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                <p className="font-semibold mb-1">Upload failed</p>
                <p className="text-xs text-red-300">{delivError}</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input ref={delivFileRef} type="file" accept=".wav,.mp3,.aiff,.flac,.zip" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setPendingDelivFile(f); setPendingDelivLabel(f.name.replace(/\.[^.]+$/, '')); setDelivSuccess(false); setDelivError(''); }
                e.target.value = '';
              }} className="hidden" />
              <Button size="sm" onClick={() => delivFileRef.current?.click()} disabled={uploadingDeliv}
                className="bg-zinc-700 hover:bg-zinc-600 text-white gap-2">
                <Plus className="w-3.5 h-3.5" />
                Select Final File
              </Button>
              {pendingDelivFile && !uploadingDeliv && (
                <Button size="sm" onClick={handleUploadDeliverable} className="bg-green-600 hover:bg-green-700 text-white gap-2">
                  <Upload className="w-3.5 h-3.5" />
                  Upload
                </Button>
              )}
            </div>

            {deliverables.length > 0 && order.status !== 'completed' && (
              <div className="pt-2 border-t border-zinc-800">
                <Button size="sm" onClick={handleMarkComplete} disabled={updatingStatus} className="w-full bg-green-600 hover:bg-green-700 text-white gap-2">
                  {updatingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Mark Order as Complete ({deliverables.length} file{deliverables.length !== 1 ? 's' : ''})
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Completed */}
      {order.status === 'completed' && deliverables.length > 0 && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-green-400 font-semibold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Order Complete — {deliverables.length} file{deliverables.length !== 1 ? 's' : ''} delivered
          </div>
          {order.tier !== 'tier-3' && order.price && (
            <Button
              size="sm"
              variant="outline"
              className="text-amber-300 border-amber-500/30 hover:bg-amber-500/10"
              onClick={async () => {
                let tid = order.talent_id || '';
                if (!tid && order.voice_selection) {
                  const { data: matched } = await supabase
                    .from('talents')
                    .select('id')
                    .ilike('name', `%${order.voice_selection.split('(')[0].trim()}%`)
                    .eq('is_active', true)
                    .limit(1)
                    .single();
                  if (matched?.id) {
                    tid = matched.id;
                    await assignOrderTalent(order.id, matched.id);
                  }
                }
                if (!tid) {
                  toast({ title: 'No matching talent', description: `Cannot find a talent matching "${order.voice_selection}" in the database.`, variant: 'destructive' });
                  return;
                }
                const res = await fetch('/api/admin/earnings', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    orderId: order.id,
                    orderType: 'voice',
                    orderNumber: String(order.order_number),
                    tier: order.tier,
                    talentId: tid,
                    orderTotal: order.price,
                  }),
                });
                if (res.ok) {
                  toast({ title: 'Earning created', description: 'Talent payout record generated successfully.' });
                } else {
                  const data = await res.json();
                  toast({ title: 'Failed', description: data.error || 'Could not create earning', variant: 'destructive' });
                }
              }}
            >
              Retry: Generate Talent Payout
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
