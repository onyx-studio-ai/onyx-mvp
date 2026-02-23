'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download, FileAudio, CheckCircle2, Loader2, Mic,
  Clock, RotateCcw, Play, Pause, Send, Lock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';

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
}

interface Props {
  order: VoiceOrder;
  onRefresh: () => void;
}

const VOICE_STATUS_STEPS = [
  { key: 'paid', labelKey: 'statusInQueue' },
  { key: 'in_production', labelKey: 'statusInProduction' },
  { key: 'delivered', labelKey: 'statusReview' },
  { key: 'awaiting_final', labelKey: 'statusFinalizing' },
  { key: 'completed', labelKey: 'statusComplete' },
];

function getStepIndex(status: string) {
  const idx = VOICE_STATUS_STEPS.findIndex(s => s.key === status);
  return idx === -1 ? 0 : idx;
}

function AudioPreview({ url, label }: { url: string; label: string }) {
  const [playing, setPlaying] = useState(false);
  const [audio] = useState(() => typeof Audio !== 'undefined' ? new Audio(url) : null);

  useEffect(() => {
    if (!audio) return;
    audio.onended = () => setPlaying(false);
    return () => { audio.pause(); };
  }, [audio]);

  const toggle = () => {
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play(); setPlaying(true); }
  };

  return (
    <button onClick={toggle}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-sm text-gray-300 hover:text-white transition-all">
      {playing ? <Pause className="w-3.5 h-3.5 text-cyan-400" /> : <Play className="w-3.5 h-3.5 text-cyan-400" />}
      {label}
    </button>
  );
}

export default function VoiceOrderDetail({ order, onRefresh }: Props) {
  const { toast } = useToast();
  const t = useTranslations('dashboard.voiceDetail');
  const [versions, setVersions] = useState<Version[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [showRevisionForm, setShowRevisionForm] = useState(false);

  const maxRev = order.max_revisions ?? 2;
  const usedRev = order.revision_count ?? 0;
  const canRequestChanges = usedRev < maxRev;
  const REVISION_LABEL_KEYS: Record<string, string> = {
    'tier-1': 'aiRetakes',
    'tier-2': 'directorRevisions',
    'tier-3': 'performancePickups',
  };
  const revisionLabel = REVISION_LABEL_KEYS[order.tier] ? t(REVISION_LABEL_KEYS[order.tier]) : 'Revisions';

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    const [vRes, dRes] = await Promise.all([
      supabase.from('voice_order_versions').select('*').eq('voice_order_id', order.id).order('version_number', { ascending: true }),
      supabase.from('voice_order_deliverables').select('*').eq('voice_order_id', order.id).order('sort_order', { ascending: true }),
    ]);
    setVersions(vRes.data || []);
    setDeliverables(dRes.data || []);
    setLoadingData(false);
  }, [order.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const latestVersion = versions[versions.length - 1];
  const currentStep = getStepIndex(order.status);

  const handleApproveVersion = async () => {
    if (!latestVersion) return;
    setSubmitting(true);
    try {
      await supabase.from('voice_order_versions').update({ status: 'approved' }).eq('id', latestVersion.id);
      await supabase.from('voice_orders').update({ status: 'awaiting_final' }).eq('id', order.id);
      try {
        await fetch('/api/mail/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflow: 'voice',
            type: 'version_approved',
            email: order.email,
            orderNumber: order.order_number,
            orderId: order.id,
            category: 'PRODUCTION',
            versionNumber: versions.length,
          }),
        });
      } catch { /* non-critical */ }
      toast({ title: 'Version approved!', description: 'We will now prepare your final files.' });
      fetchData();
      onRefresh();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!revisionNotes.trim()) {
      toast({ title: 'Please describe the changes needed', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      if (latestVersion) {
        await supabase.from('voice_order_versions').update({
          status: 'revision_requested',
          client_feedback: revisionNotes.trim(),
        }).eq('id', latestVersion.id);
      }
      await supabase.from('voice_orders').update({ status: 'in_production' }).eq('id', order.id);
      try {
        await fetch('/api/mail/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflow: 'voice',
            type: 'revision_requested',
            email: order.email,
            orderNumber: order.order_number,
            orderId: order.id,
            category: 'PRODUCTION',
            clientFeedback: revisionNotes.trim(),
          }),
        });
      } catch { /* non-critical */ }
      setRevisionNotes('');
      setShowRevisionForm(false);
      toast({ title: 'Revision request sent', description: 'Our team will get back to you shortly.' });
      fetchData();
      onRefresh();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm py-8">
        <Loader2 className="w-4 h-4 animate-spin" />
        {t('loadingOrderDetails')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-6">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-5 font-medium">{t('productionProgress')}</p>
        <div className="flex items-center gap-0">
          {VOICE_STATUS_STEPS.map((step, idx) => {
            const isCompleted = idx < currentStep;
            const isCurrent = idx === currentStep;
            return (
              <div key={step.key} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    isCompleted ? 'bg-green-500 text-white' :
                    isCurrent ? 'bg-cyan-500 text-white ring-2 ring-cyan-500/30 ring-offset-2 ring-offset-[#0a0a0a]' :
                    'bg-zinc-800 text-zinc-600 border border-zinc-700'
                  }`}>
                    {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                  </div>
                  <p className={`text-[11px] mt-2 font-semibold text-center leading-tight max-w-[60px] ${
                    isCurrent ? 'text-cyan-400' : isCompleted ? 'text-green-400/70' : 'text-zinc-600'
                  }`}>
                    {t(step.labelKey)}
                  </p>
                </div>
                {idx < VOICE_STATUS_STEPS.length - 1 && (
                  <div className={`h-px flex-1 mx-1 mb-5 ${isCompleted ? 'bg-green-500/50' : 'bg-zinc-800'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Revision Counter */}
      {maxRev > 0 && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
          !canRequestChanges
            ? 'bg-red-500/10 border border-red-500/20'
            : usedRev > 0
            ? 'bg-amber-500/10 border border-amber-500/20'
            : 'bg-cyan-500/10 border border-cyan-500/20'
        }`}>
          <span className={`text-xs ${!canRequestChanges ? 'text-red-400' : usedRev > 0 ? 'text-amber-400' : 'text-cyan-400'}`}>
            {!canRequestChanges ? (
              <><Lock className="w-3 h-3 inline mr-1" />{t('revisionLimitReached', { label: revisionLabel, max: maxRev })}</>
            ) : (
              <><span className="font-semibold">{t('revisionsRemaining', { remaining: maxRev - usedRev, label: revisionLabel.toLowerCase() })}</span> <span className="text-gray-500 ml-1">{t('revisionsUsed', { used: usedRev, max: maxRev })}</span></>
            )}
          </span>
        </div>
      )}

      {/* In Queue */}
      {order.status === 'paid' && (
        <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-5">
          <div className="flex items-center gap-2 text-yellow-400 font-semibold text-sm mb-1">
            <Clock className="w-4 h-4" />
            {t('orderInQueue')}
          </div>
          <p className="text-sm text-gray-400">{t('orderInQueueDesc')}</p>
        </div>
      )}

      {/* In Production */}
      {order.status === 'in_production' && (
        <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-5 space-y-3">
          <div className="flex items-center gap-2 text-orange-400 font-semibold text-sm">
            <Mic className="w-4 h-4" />
            {versions.length === 0
              ? t('recordingInProgress')
              : t('workingOnVersion', { version: versions.length + 1 })
            }
          </div>
          <p className="text-sm text-gray-400">
            {versions.length === 0
              ? order.tier === 'tier-1'
                ? t('tier1Desc')
                : order.tier === 'tier-2'
                ? t('tier2Desc')
                : t('tier3Desc')
              : t('incorporatingFeedback')
            }
          </p>
        </div>
      )}

      {/* Delivered — Review */}
      {order.status === 'delivered' && latestVersion && (
        <div className="space-y-4">
          <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-5 space-y-4">
            <div>
              <p className="text-cyan-400 font-semibold text-sm mb-0.5">
                {t('versionReady', { version: versions.length })}
              </p>
              <p className="text-sm text-gray-400">
                Listen to your voiceover, then either <strong className="text-white">approve</strong> to proceed to final delivery, or <strong className="text-white">request changes</strong>.
              </p>
            </div>

            {latestVersion.notes && (
              <div className="bg-black/30 rounded-xl px-4 py-3 border border-white/[0.06]">
                <p className="text-xs text-gray-500 mb-1">{t('noteFromTeam')}</p>
                <p className="text-sm text-gray-300">{latestVersion.notes}</p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <AudioPreview url={latestVersion.file_url} label={`${t('preview')} V${versions.length}`} />
              <a href={latestVersion.file_url} download
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-sm text-gray-300 hover:text-white transition-all">
                <Download className="w-3.5 h-3.5" />
                {t('download')}
              </a>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button onClick={handleApproveVersion} disabled={submitting} className="w-full bg-green-600 hover:bg-green-700 text-white gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {t('approveVersion', { version: versions.length })}
              </Button>

              {canRequestChanges ? (
                showRevisionForm ? (
                  <div className="col-span-full space-y-3">
                    <p className="text-xs text-gray-500">{t('describeChanges')}</p>
                    <textarea
                      rows={3}
                      placeholder="e.g. 'Please adjust the pacing in the second paragraph — it feels too rushed.'"
                      value={revisionNotes}
                      onChange={(e) => setRevisionNotes(e.target.value)}
                      className="w-full text-sm bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white resize-none focus:outline-none focus:border-cyan-500 placeholder:text-gray-600"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleRequestRevision} disabled={submitting || !revisionNotes.trim()} className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2">
                        {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        {t('submitRevisionRequest')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setShowRevisionForm(false); setRevisionNotes(''); }} className="border-zinc-700 text-gray-400">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button onClick={() => setShowRevisionForm(true)} className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2">
                    <RotateCcw className="w-4 h-4" />
                    {t('requestChanges')}
                  </Button>
                )
              ) : (
                <div className="col-span-full flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                  <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{t('revisionLimitReachedMsg', { label: revisionLabel, max: maxRev })}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Awaiting Final */}
      {order.status === 'awaiting_final' && (
        <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-5 space-y-2">
          <div className="flex items-center gap-2 text-orange-400 font-semibold text-sm">
            <Clock className="w-4 h-4" />
            {t('versionApproved')}
          </div>
          <p className="text-sm text-gray-400">
            {t('versionApprovedDesc')}
          </p>
        </div>
      )}

      {/* Version History */}
      {versions.length > 1 && order.status !== 'delivered' && (
        <details className="rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <summary className="px-5 py-4 text-sm text-gray-400 cursor-pointer hover:text-white transition-colors list-none flex items-center gap-2">
            <Mic className="w-3.5 h-3.5" />
            {t('versionHistory')} ({t('versionCount', { count: versions.length })})
          </summary>
          <div className="px-5 pb-5 space-y-3 border-t border-white/[0.06] pt-4">
            {versions.slice().reverse().map((ver, idx) => {
              const verNum = versions.length - idx;
              const isApproved = ver.status === 'approved';
              return (
                <div key={ver.id} className={`rounded-lg p-3.5 border ${
                  isApproved ? 'bg-green-500/10 border-green-500/25' : 'bg-cyan-500/10 border-cyan-500/15'
                }`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge variant="outline" className={`text-xs ${isApproved ? 'border-green-500/30 text-green-400' : 'border-cyan-500/30 text-cyan-400'}`}>
                      V{verNum}
                    </Badge>
                    <span className="text-xs text-gray-600">{new Date(ver.created_at).toLocaleDateString()}</span>
                    {isApproved && (
                      <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30 gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" /> {t('approved')}
                      </Badge>
                    )}
                    {ver.status === 'revision_requested' && (
                      <Badge className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">
                        {t('revisionRequested')}
                      </Badge>
                    )}
                  </div>
                  {ver.notes && <p className="text-xs text-gray-500 mb-1">{t('teamNote', { notes: ver.notes })}</p>}
                  {ver.client_feedback && <p className="text-xs text-amber-300 mb-1">{t('yourFeedback', { feedback: ver.client_feedback })}</p>}
                  {ver.file_url && (
                    <div className="flex items-center gap-2 mt-2">
                      <AudioPreview url={ver.file_url} label={t('preview')} />
                      <a href={ver.file_url} download className="text-xs text-blue-400 hover:underline inline-flex items-center gap-1">
                        <Download className="w-3 h-3" /> {t('download')}
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      )}

      {/* Completed — Download */}
      {order.status === 'completed' && deliverables.length > 0 && (
        <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-5 space-y-4">
          <div className="flex items-center gap-2 text-green-400 font-semibold">
            <CheckCircle2 className="w-5 h-5" />
            {t('voiceoverReady')}
          </div>
          <p className="text-sm text-gray-400">{t('allFinalFiles')}</p>
          <div className="space-y-2">
            {deliverables.map((deliv) => (
              <div key={deliv.id} className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3">
                <FileAudio className="w-4 h-4 text-green-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 font-medium">{deliv.label || deliv.file_name}</p>
                  <p className="text-xs text-gray-500">{deliv.file_type.toUpperCase()}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <AudioPreview url={deliv.file_url} label={t('preview')} />
                  <a href={deliv.file_url} download
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-400 text-xs font-medium transition-colors">
                    <Download className="w-3.5 h-3.5" />
                    {t('download')}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
