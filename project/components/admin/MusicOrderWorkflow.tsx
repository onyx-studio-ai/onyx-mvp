'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Upload, Play, CheckCircle2, Loader2, Trash2, Music2,
  Send, FileAudio, RefreshCw, Lock, ArrowRight, X, Plus, Layers, Calendar
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import DemoAnnotationView from './DemoAnnotationView';

interface Version {
  id: string;
  file_url: string;
  file_name: string;
  notes: string;
  version_number: number;
  version_type: string;
  is_final: boolean;
  overall_rating: number | null;
  overall_notes: string;
  revision_request: string;
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

interface MusicOrder {
  id: string;
  order_number: string;
  email: string;
  status: string;
  tier: string;
  price?: number;
  talent_id?: string | null;
  version_count: number;
  max_versions: number;
  confirmed_version_id: string | null;
  awaiting_final_upload: boolean;
  estimated_delivery_date?: string | null;
}

interface MusicOrderWorkflowProps {
  order: MusicOrder;
  onStatusChange: () => void;
}

interface PendingFile {
  file: File;
  notes: string;
}

interface PendingDeliverable {
  file: File;
  label: string;
  fileType: string;
}

const STATUS_LABELS: Record<string, string> = {
  paid: 'In Queue',
  in_production: 'In Production',
  demo_ready: 'Direction Demos Ready',
  version_ready: 'Version Ready for Review',
  awaiting_final: 'Awaiting Final Upload',
  completed: 'Completed',
};

const FILE_TYPE_OPTIONS = [
  { value: 'mp3', label: 'MP3' },
  { value: 'wav', label: 'WAV' },
  { value: 'flac', label: 'FLAC' },
  { value: 'stem', label: 'Stems' },
  { value: 'midi', label: 'MIDI' },
  { value: 'project', label: 'Project File' },
  { value: 'zip', label: 'ZIP' },
  { value: 'other', label: 'Other' },
];

function sanitizePath(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9._\-/]/g, '_');
}

async function uploadFileDirect(file: File, path: string): Promise<string> {
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

async function updateMusicOrderStatus(orderId: string, status: string, extra?: Record<string, unknown>) {
  const res = await fetch('/api/admin/orders', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, orderType: 'music', updates: { status, ...extra } }),
  });
  if (!res.ok) {
    const d = await res.json();
    throw new Error(d.error || 'Failed to update');
  }
}

async function sendWorkflowEmail(
  type: string,
  email: string,
  orderNumber: string,
  orderId: string,
  extra?: Record<string, unknown>
) {
  try {
    console.log(`[MusicWorkflow] Sending email: type=${type}, to=${email}, order=#${orderNumber}`);
    const res = await fetch('/api/mail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow: 'music', type, email, orderNumber, orderId, category: 'PRODUCTION', ...extra }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error(`[MusicWorkflow] Email API error: ${res.status}`, data);
    } else {
      console.log(`[MusicWorkflow] Email sent successfully:`, data);
    }
  } catch (err) {
    console.error('[MusicWorkflow] Email send failed:', err);
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadArea({
  pendingFiles,
  uploading,
  uploadProgress,
  uploadCurrent,
  uploadSuccess,
  successMsg,
  onFilePick,
  onRemovePending,
  onUpload,
  fileInputRef,
  accentColor,
  title,
  hint,
  children,
}: {
  pendingFiles: PendingFile[];
  uploading: boolean;
  uploadProgress: number;
  uploadCurrent: string;
  uploadSuccess: boolean;
  successMsg: string;
  onFilePick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePending: (idx: number) => void;
  onUpload: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  accentColor: string;
  title: string;
  hint: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden`}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
        <Music2 className={`w-4 h-4 text-${accentColor}-400`} />
        <span className={`text-sm font-semibold text-${accentColor}-400`}>{title}</span>
      </div>
      <div className="p-4 space-y-3">
        {children}

        {pendingFiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
              Queued ({pendingFiles.length} file{pendingFiles.length > 1 ? 's' : ''})
            </p>
            {pendingFiles.map((p, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
                <FileAudio className={`w-4 h-4 text-${accentColor}-400 flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{p.file.name}</p>
                  <p className="text-xs text-gray-500">{formatBytes(p.file.size)}</p>
                </div>
                <Input
                  placeholder="Notes (optional)"
                  value={p.notes}
                  onChange={(e) => {
                    const el = e.target as HTMLInputElement;
                    el.dispatchEvent(new CustomEvent('notechange', { detail: { idx, notes: el.value }, bubbles: true }));
                  }}
                  className="w-40 text-xs bg-zinc-700 border-zinc-600 h-7"
                />
                <button onClick={() => onRemovePending(idx)} className="text-zinc-500 hover:text-red-400 p-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {uploading && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span className="truncate max-w-[70%]">{uploadCurrent}</span>
              <span className={`font-mono font-semibold text-${accentColor}-400`}>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-2">
              <div
                className={`bg-${accentColor}-500 h-2 rounded-full transition-all duration-500`}
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {uploadSuccess && !uploading && (
          <div className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            {successMsg}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".wav,.mp3,.aiff,.flac,.zip"
            multiple
            onChange={onFilePick}
            className="hidden"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="border-zinc-700 text-gray-300 hover:text-white gap-2"
          >
            <Plus className="w-3.5 h-3.5" />
            Select Files
          </Button>
          {pendingFiles.length > 0 && !uploading && (
            <Button
              size="sm"
              onClick={onUpload}
              className={`bg-${accentColor}-600 hover:bg-${accentColor}-700 text-white gap-2`}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload {pendingFiles.length} File{pendingFiles.length > 1 ? 's' : ''}
            </Button>
          )}
          {uploading && (
            <div className={`flex items-center gap-2 text-sm text-${accentColor}-400`}>
              <Loader2 className="w-4 h-4 animate-spin" />
              Uploading...
            </div>
          )}
        </div>
        <p className="text-xs text-gray-600">{hint}</p>
      </div>
    </div>
  );
}

export default function MusicOrderWorkflow({ order, onStatusChange }: MusicOrderWorkflowProps) {
  const { toast } = useToast();
  const [versions, setVersions] = useState<Version[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [pendingDemos, setPendingDemos] = useState<PendingFile[]>([]);
  const [uploadingDemos, setUploadingDemos] = useState(false);
  const [uploadDemoProgress, setUploadDemoProgress] = useState(0);
  const [uploadDemoCurrent, setUploadDemoCurrent] = useState('');
  const [uploadDemoSuccess, setUploadDemoSuccess] = useState(false);
  const demoFileRef = useRef<HTMLInputElement>(null);

  const [pendingVersions, setPendingVersions] = useState<PendingFile[]>([]);
  const [uploadingVersions, setUploadingVersions] = useState(false);
  const [uploadVersionProgress, setUploadVersionProgress] = useState(0);
  const [uploadVersionCurrent, setUploadVersionCurrent] = useState('');
  const [uploadVersionSuccess, setUploadVersionSuccess] = useState(false);
  const versionFileRef = useRef<HTMLInputElement>(null);

  const [pendingDeliverables, setPendingDeliverables] = useState<PendingDeliverable[]>([]);
  const [uploadingDeliverables, setUploadingDeliverables] = useState(false);
  const [uploadDelivProgress, setUploadDelivProgress] = useState(0);
  const [uploadDelivCurrent, setUploadDelivCurrent] = useState('');
  const delivFileRef = useRef<HTMLInputElement>(null);

  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [estimatedDate, setEstimatedDate] = useState(order.estimated_delivery_date || '');

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [versionsRes, deliverablesRes] = await Promise.all([
        supabase.from('music_order_versions').select('*').eq('music_order_id', order.id).order('version_number', { ascending: true }),
        supabase.from('music_order_deliverables').select('*').eq('music_order_id', order.id).order('sort_order', { ascending: true }),
      ]);
      if (versionsRes.error) console.error('Failed to load versions:', versionsRes.error.message);
      if (deliverablesRes.error) console.error('Failed to load deliverables:', deliverablesRes.error.message);
      setVersions(versionsRes.data || []);
      setDeliverables(deliverablesRes.data || []);
    } catch (err) {
      console.error('Failed to fetch music order data:', err);
    } finally {
      setLoadingData(false);
    }
  }, [order.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDemoFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setPendingDemos(prev => [...prev, ...files.map(f => ({ file: f, notes: '' }))]);
    setUploadDemoSuccess(false);
    e.target.value = '';
  };

  const handleVersionFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setPendingVersions(prev => [...prev, ...files.map(f => ({ file: f, notes: '' }))]);
    setUploadVersionSuccess(false);
    e.target.value = '';
  };

  const handleUploadDemos = async () => {
    if (pendingDemos.length === 0) return;
    setUploadingDemos(true);
    setUploadDemoProgress(0);
    setUploadDemoSuccess(false);

    const existingDemos = versions.filter(v => v.version_type === 'demo');
    const nextNumber = existingDemos.length + 1;
    const isFirstUpload = existingDemos.length === 0;

    try {
      for (let i = 0; i < pendingDemos.length; i++) {
        const { file, notes } = pendingDemos[i];
        setUploadDemoCurrent(`Uploading ${file.name.length > 40 ? file.name.slice(0, 40) + '...' : file.name} (${i + 1}/${pendingDemos.length})`);
        setUploadDemoProgress(Math.round((i / pendingDemos.length) * 100));

        const filePath = `demos/${order.id}/${Date.now()}-${file.name}`;
        const publicUrl = await uploadFileDirect(file, filePath);

        const { error: insertErr } = await supabase.from('music_order_versions').insert({
          music_order_id: order.id,
          file_url: publicUrl,
          file_name: file.name,
          notes,
          version_number: nextNumber + i,
          version_type: 'demo',
          is_final: false,
        });
        if (insertErr) throw insertErr;
      }

      setUploadDemoProgress(100);
      setUploadDemoCurrent('');

      if (isFirstUpload) {
        console.log('[MusicWorkflow] First demo upload — notifying client:', order.email);
        await updateMusicOrderStatus(order.id, 'demo_ready');
        await sendWorkflowEmail('demos_ready', order.email, order.order_number, order.id);
        onStatusChange();
      } else {
        console.log('[MusicWorkflow] Additional demos added — sending update to client:', order.email);
        if (order.status !== 'demo_ready') {
          await updateMusicOrderStatus(order.id, 'demo_ready');
          onStatusChange();
        }
        await sendWorkflowEmail('demos_ready', order.email, order.order_number, order.id);
      }

      setPendingDemos([]);
      setUploadDemoSuccess(true);
      toast({
        title: `${pendingDemos.length} direction demo${pendingDemos.length > 1 ? 's' : ''} uploaded`,
        description: isFirstUpload ? 'Client has been notified by email.' : 'Additional demos added.',
      });
      fetchData();
    } catch (err: unknown) {
      setUploadDemoCurrent('');
      setUploadDemoProgress(0);
      toast({ title: 'Upload failed', description: err instanceof Error ? err.message : 'Error', variant: 'destructive' });
    } finally {
      setUploadingDemos(false);
    }
  };

  const handleUploadVersion = async () => {
    if (pendingVersions.length === 0) return;
    setUploadingVersions(true);
    setUploadVersionProgress(0);
    setUploadVersionSuccess(false);

    const existingRevisions = versions.filter(v => v.version_type === 'revision');
    const nextNumber = existingRevisions.length + 1;

    try {
      for (let i = 0; i < pendingVersions.length; i++) {
        const { file, notes } = pendingVersions[i];
        setUploadVersionCurrent(`Uploading ${file.name.length > 40 ? file.name.slice(0, 40) + '...' : file.name} (${i + 1}/${pendingVersions.length})`);
        setUploadVersionProgress(Math.round((i / pendingVersions.length) * 100));

        const filePath = `revisions/${order.id}/${Date.now()}-${file.name}`;
        const publicUrl = await uploadFileDirect(file, filePath);

        const { error: insertErr } = await supabase.from('music_order_versions').insert({
          music_order_id: order.id,
          file_url: publicUrl,
          file_name: file.name,
          notes,
          version_number: nextNumber + i,
          version_type: 'revision',
          is_final: false,
        });
        if (insertErr) throw insertErr;
      }

      const newVersionCount = (order.version_count || 0) + pendingVersions.length;
      await updateMusicOrderStatus(order.id, 'version_ready', { version_count: newVersionCount });
      await sendWorkflowEmail('revision_ready', order.email, order.order_number, order.id, {
        versionsUsed: newVersionCount,
        maxRevisions: order.max_versions,
      });

      setUploadVersionProgress(100);
      setUploadVersionCurrent('');
      setPendingVersions([]);
      setUploadVersionSuccess(true);
      toast({
        title: `Version ${nextNumber} uploaded`,
        description: 'Client has been notified by email.',
      });
      fetchData();
      onStatusChange();
    } catch (err: unknown) {
      setUploadVersionCurrent('');
      setUploadVersionProgress(0);
      toast({ title: 'Upload failed', description: err instanceof Error ? err.message : 'Error', variant: 'destructive' });
    } finally {
      setUploadingVersions(false);
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    try {
      await supabase.from('music_order_versions').delete().eq('id', versionId);
      fetchData();
      toast({ title: 'Version removed' });
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Delete failed', variant: 'destructive' });
    }
  };

  const handleDeliverableFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setPendingDeliverables(prev => [
      ...prev,
      ...files.map(f => ({ file: f, label: f.name.replace(/\.[^.]+$/, ''), fileType: 'wav' })),
    ]);
    e.target.value = '';
  };

  const updatePendingDeliv = (idx: number, field: 'label' | 'fileType', value: string) => {
    setPendingDeliverables(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const removePendingDeliv = (idx: number) => {
    setPendingDeliverables(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUploadDeliverables = async () => {
    if (pendingDeliverables.length === 0) return;
    setUploadingDeliverables(true);
    setUploadDelivProgress(0);
    try {
      for (let i = 0; i < pendingDeliverables.length; i++) {
        const { file, label, fileType } = pendingDeliverables[i];
        setUploadDelivCurrent(`Uploading ${file.name.length > 40 ? file.name.slice(0, 40) + '...' : file.name} (${i + 1}/${pendingDeliverables.length})`);
        setUploadDelivProgress(Math.round((i / pendingDeliverables.length) * 100));
        const filePath = `finals/${order.id}/${Date.now()}-${file.name}`;
        const publicUrl = await uploadFileDirect(file, filePath);
        const { error: insertErr } = await supabase.from('music_order_deliverables').insert({
          music_order_id: order.id,
          file_url: publicUrl,
          file_name: file.name,
          file_type: fileType,
          label: label || file.name,
          sort_order: deliverables.length + i,
        });
        if (insertErr) throw insertErr;
      }
      setUploadDelivProgress(100);
      setUploadDelivCurrent('');
      setPendingDeliverables([]);
      toast({ title: `${pendingDeliverables.length} file${pendingDeliverables.length > 1 ? 's' : ''} uploaded` });
      fetchData();
    } catch (err: unknown) {
      setUploadDelivCurrent('');
      setUploadDelivProgress(0);
      toast({ title: 'Upload failed', description: err instanceof Error ? err.message : 'Error', variant: 'destructive' });
    } finally {
      setUploadingDeliverables(false);
    }
  };

  const handleDeleteDeliverable = async (delivId: string) => {
    try {
      await supabase.from('music_order_deliverables').delete().eq('id', delivId);
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
      await updateMusicOrderStatus(order.id, 'completed');
      await sendWorkflowEmail('final_ready', order.email, order.order_number, order.id);

      if (order.talent_id && order.price) {
        try {
          await fetch('/api/admin/earnings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: order.id,
              orderType: 'music',
              orderNumber: String(order.order_number),
              tier: order.tier,
              talentId: order.talent_id,
              orderTotal: order.price,
            }),
          });
        } catch { /* earnings can be added manually */ }
      }

      toast({ title: 'Order completed', description: 'Client notified by email.' });
      onStatusChange();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleStartProduction = async () => {
    if (!estimatedDate) return;
    setUpdatingStatus(true);
    try {
      await updateMusicOrderStatus(order.id, 'in_production', {
        estimated_delivery_date: estimatedDate,
      });
      await sendWorkflowEmail('production_started', order.email, order.order_number, order.id, {
        estimatedDate: new Date(estimatedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      });
      toast({ title: 'Production started', description: 'Client notified with estimated delivery date.' });
      onStatusChange();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const demoBatch = versions.filter(v => v.version_type === 'demo');
  const revisionBatch = versions.filter(v => v.version_type === 'revision');
  const confirmedVersion = versions.find(v => v.id === order.confirmed_version_id);
  const confirmedRevisionIndex = confirmedVersion?.version_type === 'revision'
    ? revisionBatch.indexOf(confirmedVersion)
    : -1;
  const confirmedVersionIndex = confirmedVersion ? versions.indexOf(confirmedVersion) : -1;
  const maxVerStr = String(order.max_versions);

  const isDemoPhase = ['paid', 'in_production', 'demo_ready'].includes(order.status) && !order.confirmed_version_id;
  const isRevisionPhase = ['in_production', 'version_ready'].includes(order.status) && !!order.confirmed_version_id;
  const isFinalPhase = order.status === 'awaiting_final';

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

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Workflow Stage</span>
          <Badge variant="outline" className="border-blue-500/30 text-blue-400">
            {STATUS_LABELS[order.status] || order.status}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>Versions: {order.version_count} / {maxVerStr}</span>
          <button onClick={fetchData} className="hover:text-white transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {order.estimated_delivery_date && order.status !== 'paid' && order.status !== 'completed' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Calendar className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-sm text-amber-300">
            Est. Delivery: {new Date(order.estimated_delivery_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      )}

      {order.status === 'paid' && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 space-y-3">
          <p className="text-sm text-yellow-300">Order paid and waiting. Set an estimated delivery date, then start production.</p>
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Estimated Delivery Date</label>
            <input
              type="date"
              value={estimatedDate}
              onChange={(e) => setEstimatedDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-amber-500/40"
              style={{ colorScheme: 'dark' }}
            />
          </div>
          <Button size="sm" onClick={handleStartProduction} disabled={updatingStatus || !estimatedDate} className="bg-orange-600 hover:bg-orange-700 text-white gap-2 w-full justify-center">
            {updatingStatus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Confirm &amp; Start Production
          </Button>
        </div>
      )}

      {isFinalPhase && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-orange-300 font-semibold text-sm">
            <Lock className="w-4 h-4" />
            {confirmedRevisionIndex >= 0
              ? `Client confirmed V${confirmedRevisionIndex + 1} — upload final deliverables below`
              : confirmedVersionIndex >= 0
                ? `Client confirmed direction demo — upload final deliverables below`
                : 'Client confirmed version — upload final deliverables below'
            }
          </div>
          {confirmedVersion?.overall_notes && (
            <p className="text-xs text-gray-400">Client notes: {confirmedVersion.overall_notes}</p>
          )}
          <p className="text-xs text-gray-500">Upload WAV/MP3/stems/ZIP below, then click Mark Order as Complete.</p>
        </div>
      )}

      {isRevisionPhase && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 space-y-1">
          <p className="text-sm font-semibold text-blue-300">Client requested changes — upload revised version</p>
          <p className="text-xs text-gray-400">
            {confirmedRevisionIndex >= 0
              ? `Client confirmed V${confirmedRevisionIndex + 1}. Upload a new revised version below and the client will be notified.`
              : `Client confirmed direction demo. Upload the first full version below and the client will be notified.`
            }
          </p>
        </div>
      )}

      {demoBatch.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
            <Layers className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-amber-400">Direction Demos ({demoBatch.length} uploaded)</span>
            <span className="text-xs text-gray-500 ml-auto">Client picks a direction from these</span>
          </div>
          <div className="divide-y divide-zinc-800">
            {demoBatch.map((ver, idx) => (
              <div key={ver.id} className={`px-4 py-3 ${ver.id === order.confirmed_version_id ? 'bg-green-500/5' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-5 flex-shrink-0 text-center">D{idx + 1}</span>
                  <FileAudio className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate font-medium">{ver.file_name}</p>
                    {ver.notes && <p className="text-xs text-gray-500">{ver.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {ver.id === order.confirmed_version_id && (
                      <Badge variant="outline" className="border-green-500/40 text-green-400 text-xs">Direction Chosen</Badge>
                    )}
                    <a href={ver.file_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                      <Play className="w-3 h-3" /> Play
                    </a>
                    <button onClick={() => handleDeleteVersion(ver.id)}
                      className="text-zinc-600 hover:text-red-400 transition-colors p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-2">
                  <DemoAnnotationView
                    demoId={ver.id}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {revisionBatch.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
            <Music2 className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-cyan-400">Revision Versions ({revisionBatch.length} uploaded)</span>
            <span className="text-xs text-gray-500 ml-auto">Client reviews and requests changes</span>
          </div>
          <div className="divide-y divide-zinc-800">
            {revisionBatch.map((ver, idx) => {
              const isConfirmed = ver.id === order.confirmed_version_id;
              return (
                <div key={ver.id} className={`px-4 py-3 ${isConfirmed ? 'bg-green-500/8 border-l-2 border-l-green-500' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${isConfirmed ? 'bg-green-500 text-white' : 'bg-zinc-800'}`}>
                      {isConfirmed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="text-xs text-gray-500">V{idx + 1}</span>}
                    </div>
                    <FileAudio className={`w-4 h-4 flex-shrink-0 ${isConfirmed ? 'text-green-400' : 'text-cyan-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm text-gray-200 truncate font-medium">{ver.file_name}</p>
                        {isConfirmed && (
                          <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/40 gap-1 shrink-0">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Client Confirmed V{idx + 1}
                          </Badge>
                        )}
                      </div>
                      {ver.notes && <p className="text-xs text-gray-500">{ver.notes}</p>}
                      <p className="text-xs text-gray-600">{new Date(ver.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a href={ver.file_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                        <Play className="w-3 h-3" /> Play
                      </a>
                      <button onClick={() => handleDeleteVersion(ver.id)}
                        className="text-zinc-600 hover:text-red-400 transition-colors p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2">
                    <DemoAnnotationView
                      demoId={ver.id}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isDemoPhase && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
            <Layers className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-amber-400">
              {demoBatch.length === 0 ? 'Upload Direction Demos' : 'Add More Direction Demos'}
            </span>
          </div>
          <div className="p-4 space-y-3">
            {pendingDemos.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                  Queued ({pendingDemos.length} file{pendingDemos.length > 1 ? 's' : ''})
                </p>
                {pendingDemos.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
                    <FileAudio className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate">{p.file.name}</p>
                      <p className="text-xs text-gray-500">{formatBytes(p.file.size)}</p>
                    </div>
                    <Input
                      placeholder="Direction note (optional)"
                      value={p.notes}
                      onChange={(e) => setPendingDemos(prev => prev.map((pd, i) => i === idx ? { ...pd, notes: e.target.value } : pd))}
                      className="w-44 text-xs bg-zinc-700 border-zinc-600 h-7"
                    />
                    <button onClick={() => setPendingDemos(prev => prev.filter((_, i) => i !== idx))} className="text-zinc-500 hover:text-red-400 p-1">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {uploadingDemos && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="truncate max-w-[70%]">{uploadDemoCurrent}</span>
                  <span className="font-mono font-semibold text-amber-400">{uploadDemoProgress}%</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-2">
                  <div className="bg-amber-500 h-2 rounded-full transition-all duration-500" style={{ width: `${uploadDemoProgress}%` }} />
                </div>
              </div>
            )}

            {uploadDemoSuccess && !uploadingDemos && (
              <div className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                {demoBatch.length === 0 ? 'Demos uploaded — client notified by email.' : 'More demos added successfully.'}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input ref={demoFileRef} type="file" accept=".wav,.mp3,.aiff,.flac" multiple onChange={handleDemoFilePick} className="hidden" />
              <Button size="sm" onClick={() => demoFileRef.current?.click()} disabled={uploadingDemos} className="bg-zinc-700 hover:bg-zinc-600 text-white gap-2">
                <Plus className="w-3.5 h-3.5" />
                Select Demos
              </Button>
              {pendingDemos.length > 0 && !uploadingDemos && (
                <Button size="sm" onClick={handleUploadDemos} className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
                  <Upload className="w-3.5 h-3.5" />
                  Upload {pendingDemos.length} Demo{pendingDemos.length > 1 ? 's' : ''}
                </Button>
              )}
              {uploadingDemos && (
                <div className="flex items-center gap-2 text-sm text-amber-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </div>
              )}
            </div>
            <p className="text-xs text-gray-600">
              {demoBatch.length === 0
                ? 'Upload 5–10 direction demos. Client picks one direction, then full production begins.'
                : `${demoBatch.length} demo${demoBatch.length > 1 ? 's' : ''} uploaded. You can add more at any time before the client confirms a direction.`}
            </p>
          </div>
        </div>
      )}

      {isRevisionPhase && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
            <Send className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-cyan-400">Upload New Version (V{revisionBatch.length + 1})</span>
          </div>
          <div className="p-4 space-y-3">
            {pendingVersions.length > 0 && (
              <div className="space-y-2">
                {pendingVersions.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
                    <FileAudio className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate">{p.file.name}</p>
                      <p className="text-xs text-gray-500">{formatBytes(p.file.size)}</p>
                    </div>
                    <Input
                      placeholder="Note to client (required)"
                      value={p.notes}
                      onChange={(e) => setPendingVersions(prev => prev.map((pv, i) => i === idx ? { ...pv, notes: e.target.value } : pv))}
                      className={`w-48 text-xs bg-zinc-700 h-7 ${p.notes.trim() ? 'border-zinc-600' : 'border-red-500/50'}`}
                    />
                    <button onClick={() => setPendingVersions(prev => prev.filter((_, i) => i !== idx))} className="text-zinc-500 hover:text-red-400 p-1">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {uploadingVersions && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="truncate max-w-[70%]">{uploadVersionCurrent}</span>
                  <span className="font-mono font-semibold text-cyan-400">{uploadVersionProgress}%</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-2">
                  <div className="bg-cyan-500 h-2 rounded-full transition-all duration-500" style={{ width: `${uploadVersionProgress}%` }} />
                </div>
              </div>
            )}

            {uploadVersionSuccess && !uploadingVersions && (
              <div className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                Version uploaded — client notified by email.
              </div>
            )}

            <div className="flex items-center gap-2">
              <input ref={versionFileRef} type="file" accept=".wav,.mp3,.aiff,.flac" multiple onChange={handleVersionFilePick} className="hidden" />
              <Button size="sm" onClick={() => versionFileRef.current?.click()} disabled={uploadingVersions} className="bg-zinc-700 hover:bg-zinc-600 text-white gap-2">
                <Plus className="w-3.5 h-3.5" />
                Select Version File
              </Button>
              {pendingVersions.length > 0 && !uploadingVersions && (
                <Button
                  size="sm"
                  onClick={handleUploadVersion}
                  disabled={pendingVersions.some(pv => !pv.notes.trim())}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload V{revisionBatch.length + 1}
                </Button>
              )}
              {uploadingVersions && (
                <div className="flex items-center gap-2 text-sm text-cyan-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </div>
              )}
            </div>
            <p className="text-xs text-gray-600">Upload the revised full track with a required note explaining the changes. Client will be notified to review.</p>
          </div>
        </div>
      )}

      {(order.status === 'awaiting_final' || order.status === 'in_production' || order.status === 'version_ready') && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
            <Upload className="w-4 h-4 text-green-400" />
            <span className="text-sm font-semibold text-green-400">Final Deliverables ({deliverables.length} uploaded)</span>
          </div>

          {order.status === 'awaiting_final' && deliverables.length === 0 && pendingDeliverables.length === 0 && (
            <div className="mx-4 mt-3 flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5">
              <ArrowRight className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Client confirmed version {confirmedVersionIndex >= 0 ? confirmedVersionIndex + 1 : ''} — upload the finished WAV/MP3/ZIP below, then click <strong>Mark Order as Complete</strong>.</span>
            </div>
          )}

          {deliverables.length > 0 && (
            <div className="divide-y divide-zinc-800">
              {deliverables.map((deliv) => (
                <div key={deliv.id} className="flex items-center gap-3 px-4 py-3">
                  <FileAudio className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 font-medium truncate">{deliv.label || deliv.file_name}</p>
                    <p className="text-xs text-gray-500">{deliv.file_type.toUpperCase()} · {deliv.file_name}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a href={deliv.file_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                      <Play className="w-3 h-3" /> Play
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
            {pendingDeliverables.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Ready to upload ({pendingDeliverables.length})</p>
                {pendingDeliverables.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
                    <FileAudio className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate">{p.file.name}</p>
                      <p className="text-xs text-gray-500">{formatBytes(p.file.size)}</p>
                    </div>
                    <Input
                      placeholder="Label"
                      value={p.label}
                      onChange={(e) => updatePendingDeliv(idx, 'label', e.target.value)}
                      className="w-36 text-xs bg-zinc-700 border-zinc-600 h-7"
                    />
                    <select
                      value={p.fileType}
                      onChange={(e) => updatePendingDeliv(idx, 'fileType', e.target.value)}
                      className="text-xs bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-white focus:outline-none h-7"
                    >
                      {FILE_TYPE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <button onClick={() => removePendingDeliv(idx)} className="text-zinc-500 hover:text-red-400 p-1">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {uploadingDeliverables && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="truncate max-w-[70%]">{uploadDelivCurrent}</span>
                  <span className="font-mono font-semibold text-green-400">{uploadDelivProgress}%</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full transition-all duration-500" style={{ width: `${uploadDelivProgress}%` }} />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <input ref={delivFileRef} type="file" accept=".wav,.mp3,.aiff,.flac,.mid,.midi,.zip" multiple onChange={handleDeliverableFilePick} className="hidden" />
              <Button size="sm" onClick={() => delivFileRef.current?.click()} disabled={uploadingDeliverables} className="bg-zinc-700 hover:bg-zinc-600 text-white gap-2">
                <Plus className="w-3.5 h-3.5" />
                Select Files
              </Button>
              {pendingDeliverables.length > 0 && !uploadingDeliverables && (
                <Button size="sm" onClick={handleUploadDeliverables} className="bg-green-600 hover:bg-green-700 text-white gap-2">
                  <Upload className="w-3.5 h-3.5" />
                  Upload {pendingDeliverables.length} File{pendingDeliverables.length > 1 ? 's' : ''}
                </Button>
              )}
              {uploadingDeliverables && (
                <div className="flex items-center gap-2 text-sm text-green-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </div>
              )}
            </div>

            {deliverables.length > 0 && order.status !== 'completed' && !uploadingDeliverables && (
              <div className="pt-2 border-t border-zinc-800">
                <Button
                  size="sm"
                  onClick={handleMarkComplete}
                  disabled={updatingStatus || pendingDeliverables.length > 0}
                  className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
                >
                  {updatingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Mark Order as Complete ({deliverables.length} file{deliverables.length !== 1 ? 's' : ''} ready)
                </Button>
                {pendingDeliverables.length > 0 && (
                  <p className="text-xs text-amber-400 mt-2 text-center">Upload pending files first before marking complete.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {order.status === 'completed' && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-green-400 font-semibold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Order Complete — {deliverables.length} file{deliverables.length !== 1 ? 's' : ''} delivered
          </div>
          <div className="space-y-1.5">
            {deliverables.map((deliv) => (
              <div key={deliv.id} className="flex items-center gap-2">
                <FileAudio className="w-3.5 h-3.5 text-green-400" />
                <a href={deliv.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:text-blue-300 truncate">
                  {deliv.label || deliv.file_name}
                </a>
                <span className="text-xs text-gray-500">({deliv.file_type.toUpperCase()})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
