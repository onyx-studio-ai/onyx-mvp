'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download, FileAudio, CheckCircle2, Loader2, Music2,
  Clock, RotateCcw, Play, Pause, Send, Lock, AlertTriangle, ArrowRight, CheckCircle, Calendar
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from 'next-intl';
import DemoFeedbackPanel from './DemoFeedbackPanel';

interface Demo {
  id: string;
  file_url: string;
  file_name: string;
  notes: string;
  version_type: string;
  status: 'pending_review' | 'selected' | 'rejected';
  overall_rating: number | null;
  overall_notes: string;
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
  version_count: number;
  max_versions: number;
  confirmed_version_id: string | null;
  awaiting_final_upload: boolean;
  vibe: string;
  estimated_delivery_date?: string | null;
}

interface MusicOrderDetailProps {
  order: MusicOrder;
  onRefresh: () => void;
}

const MUSIC_STATUS_STEPS = [
  { key: 'paid', labelKey: 'statusInQueue' },
  { key: 'in_production', labelKey: 'statusInProduction' },
  { key: 'demo_ready', labelKey: 'statusPickDirection' },
  { key: 'version_ready', labelKey: 'statusReviewVersion' },
  { key: 'awaiting_final', labelKey: 'statusFinalizing' },
  { key: 'completed', labelKey: 'statusComplete' },
];

function getStepIndex(status: string) {
  const idx = MUSIC_STATUS_STEPS.findIndex(s => s.key === status);
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
    <button
      onClick={toggle}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-sm text-gray-300 hover:text-white transition-all"
    >
      {playing ? <Pause className="w-3.5 h-3.5 text-blue-400" /> : <Play className="w-3.5 h-3.5 text-blue-400" />}
      {label}
    </button>
  );
}

function RevisionPlanBanner({ max }: { max: number }) {
  const t = useTranslations('dashboard.musicDetail');
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/25">
      <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
        <CheckCircle className="w-4 h-4 text-green-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-green-400">
          {max >= 5 ? t('complimentaryRevisionsIncluded', { max }) : t('revisionsIncluded', { max })}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{t('additionalRevisions')}</p>
      </div>
    </div>
  );
}

function VersionCounter({ used, max }: { used: number; max: number }) {
  const t = useTranslations('dashboard.musicDetail');
  const remaining = max - used;
  if (remaining <= 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
        <Lock className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
        <span className="text-xs text-red-400">{t('versionLimitReachedShort', { max })}</span>
      </div>
    );
  }
  const color = remaining === 1 ? 'amber' : 'blue';
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-${color}-500/10 border border-${color}-500/20`}>
      <span className={`text-xs text-${color}-400`}>
        <span className="font-semibold">{t('revisionsRemaining', { remaining })}</span>
        <span className="text-gray-500 ml-1">{t('revisionsUsed', { used, max })}</span>
      </span>
    </div>
  );
}

async function sendNotification(
  type: string,
  email: string,
  orderNumber: string,
  orderId: string,
  extra?: { versionsUsed?: number; maxRevisions?: number; extraMessage?: string }
) {
  try {
    console.log(`[MusicClient] Sending notification: type=${type}, email=${email}, order=#${orderNumber}`);
    const res = await fetch('/api/mail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow: 'music', type, email, orderNumber, orderId, category: 'PRODUCTION', ...extra }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error(`[MusicClient] Email API error: ${res.status}`, data);
    } else {
      console.log('[MusicClient] Notification sent successfully:', data);
    }
  } catch (err) {
    console.error('[MusicClient] Notification send failed:', err);
  }
}

export default function MusicOrderDetail({ order, onRefresh }: MusicOrderDetailProps) {
  const { toast } = useToast();
  const t = useTranslations('dashboard.musicDetail');
  const [demos, setDemos] = useState<Demo[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [selectingDemo, setSelectingDemo] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const [revisionNotes, setRevisionNotes] = useState('');
  const [submittingRevision, setSubmittingRevision] = useState(false);
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [liveVersionNotes, setLiveVersionNotes] = useState('');

  const versionsUsed = order.version_count || 0;
  const canRequestChanges = versionsUsed < order.max_versions;

  const latestRevisionForHandler = demos.filter(d => d.version_type === 'revision').slice(-1)[0];

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    const [versionsRes, deliverablesRes] = await Promise.all([
      supabase.from('music_order_versions').select('*').eq('music_order_id', order.id).order('version_number', { ascending: true }),
      supabase.from('music_order_deliverables').select('*').eq('music_order_id', order.id).order('sort_order', { ascending: true }),
    ]);
    setDemos(versionsRes.data || []);
    setDeliverables(deliverablesRes.data || []);
    setLoadingData(false);
  }, [order.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSelectDemo = async (demoId: string) => {
    setSelectingDemo(true);
    try {
      await supabase.from('music_order_versions').update({ status: 'selected' }).eq('id', demoId);
      await supabase.from('music_order_versions').update({ status: 'pending_review' }).eq('music_order_id', order.id).neq('id', demoId);
      await supabase.from('music_orders').update({ confirmed_version_id: demoId }).eq('id', order.id);
      toast({ title: 'Direction selected', description: 'Add your feedback below, then confirm when ready.' });
      fetchData();
      onRefresh();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setSelectingDemo(false);
    }
  };

  const handleConfirmDirection = async () => {
    if (!order.confirmed_version_id) {
      toast({ title: 'Please select a direction first', variant: 'destructive' });
      return;
    }
    setSubmittingFeedback(true);
    try {
      await supabase.from('music_orders').update({ status: 'in_production' }).eq('id', order.id);
      await sendNotification('direction_confirmed', order.email, order.order_number, order.id);
      toast({ title: 'Direction confirmed!', description: 'Our team will now begin full production.' });
      fetchData();
      onRefresh();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleConfirmVersion = async () => {
    if (!order.confirmed_version_id) {
      toast({ title: 'Please select a version first', variant: 'destructive' });
      return;
    }
    setSubmittingFeedback(true);
    try {
      await supabase.from('music_orders').update({ status: 'awaiting_final', awaiting_final_upload: true }).eq('id', order.id);
      await sendNotification('version_confirmed', order.email, order.order_number, order.id);
      toast({ title: 'Version confirmed!', description: 'We will now prepare your final files.' });
      fetchData();
      onRefresh();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleSubmitRevision = async () => {
    if (!revisionNotes.trim()) {
      toast({ title: 'Please describe the changes needed', variant: 'destructive' });
      return;
    }
    setSubmittingRevision(true);
    try {
      if (latestRevisionForHandler?.id) {
        const updatePayload: Record<string, string> = {
          revision_request: revisionNotes.trim(),
        };
        if (liveVersionNotes.trim()) {
          updatePayload.overall_notes = liveVersionNotes.trim();
        }
        await supabase.from('music_order_versions').update(updatePayload).eq('id', latestRevisionForHandler.id);
      }
      await supabase.from('music_orders').update({
        status: 'in_production',
      }).eq('id', order.id);
      await sendNotification('changes_requested', order.email, order.order_number, order.id, { extraMessage: revisionNotes.trim() });
      setRevisionNotes('');
      setShowRevisionForm(false);
      toast({ title: 'Revision request sent', description: 'Our team will get back to you shortly.' });
      fetchData();
      onRefresh();
    } catch (err: unknown) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setSubmittingRevision(false);
    }
  };

  const currentStep = getStepIndex(order.status);
  const confirmedVersion = demos.find(d => d.id === order.confirmed_version_id);
  const confirmedVersionIndex = confirmedVersion ? demos.indexOf(confirmedVersion) : -1;

  const isAwaitingFinal = order.status === 'awaiting_final';

  const demoBatch = demos.filter(d => d.version_type === 'demo');
  const revisionVersions = demos.filter(d => d.version_type === 'revision');

  const isDemoPhase = order.status === 'demo_ready' && demoBatch.length > 0 && !order.confirmed_version_id;
  const isDemoSelectionPhase = order.status === 'demo_ready' && demoBatch.length > 0 && !!order.confirmed_version_id;

  const latestRevision = revisionVersions[revisionVersions.length - 1];
  const isRevisionReviewPhase = order.status === 'version_ready' && latestRevision?.file_url;

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

      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-6">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-5 font-medium">{t('productionProgress')}</p>
        <div className="flex items-center gap-0">
          {MUSIC_STATUS_STEPS.map((step, idx) => {
            const isCompleted = idx < currentStep;
            const isCurrent = idx === currentStep;
            return (
              <div key={step.key} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    isCompleted ? 'bg-green-500 text-white' :
                    isCurrent ? 'bg-blue-500 text-white ring-2 ring-blue-500/30 ring-offset-2 ring-offset-[#0a0a0a]' :
                    'bg-zinc-800 text-zinc-600 border border-zinc-700'
                  }`}>
                    {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                  </div>
                  <p className={`text-[11px] mt-2 font-semibold text-center leading-tight max-w-[60px] ${
                    isCurrent ? 'text-blue-400' : isCompleted ? 'text-green-400/70' : 'text-zinc-600'
                  }`}>
                    {t(step.labelKey)}
                  </p>
                </div>
                {idx < MUSIC_STATUS_STEPS.length - 1 && (
                  <div className={`h-px flex-1 mx-1 mb-5 ${isCompleted ? 'bg-green-500/50' : 'bg-zinc-800'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <RevisionPlanBanner max={order.max_versions} />

      {order.estimated_delivery_date && !['paid', 'completed'].includes(order.status) && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <Calendar className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-300">{t('estimatedDelivery')}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(order.estimated_delivery_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>
      )}

      {order.status === 'paid' && (
        <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-5">
          <div className="flex items-center gap-2 text-yellow-400 font-semibold text-sm mb-1">
            <Clock className="w-4 h-4" />
            {t('orderInQueue')}
          </div>
          <p className="text-sm text-gray-400">{t('orderInQueueDesc')}</p>
        </div>
      )}

      {order.status === 'in_production' && !order.confirmed_version_id && (
        <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-5 space-y-3">
          <div className="flex items-center gap-2 text-orange-400 font-semibold text-sm">
            <Music2 className="w-4 h-4" />
            {t('step1Title')}
          </div>
          <p className="text-sm text-gray-400">
            {t('step1Desc')}
          </p>
          <p className="text-xs text-gray-600">{t('step1Note')}</p>
        </div>
      )}

      {order.status === 'in_production' && !!order.confirmed_version_id && (
        <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-5 space-y-3">
          <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
            <Music2 className="w-4 h-4" />
            {t('step3Title', { version: revisionVersions.length + 1 })}
          </div>
          <p className="text-sm text-gray-400">
            {revisionVersions.length === 0 ? t('step3DescFirst') : t('step3DescRevision', { version: revisionVersions.length + 1 })}
          </p>
          {confirmedVersion && (
            <div className="flex items-center gap-3 rounded-xl bg-black/30 border border-blue-500/20 px-4 py-3">
              <Lock className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200 font-medium">{t('directionConfirmed')}</p>
                {confirmedVersion.notes && <p className="text-xs text-gray-500">{confirmedVersion.notes}</p>}
              </div>
              <AudioPreview url={confirmedVersion.file_url} label={t('preview')} />
            </div>
          )}
          <VersionCounter used={versionsUsed} max={order.max_versions} />
          <p className="text-xs text-gray-600">{t('versionReadyNote')}</p>
        </div>
      )}

      {isDemoPhase && (
        <div className="space-y-4">
          <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-5">
            <p className="text-blue-400 font-semibold text-sm mb-1">{t('step2Title')}</p>
            <p className="text-sm text-gray-400">
              {t('step2Desc', { count: demoBatch.length })}
            </p>
          </div>

          <div className="space-y-3">
            {demoBatch.map((demo, idx) => (
              <div key={demo.id} className={`rounded-xl border transition-all ${
                demo.status === 'selected'
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-white/[0.03] border-white/[0.07] hover:border-white/[0.14]'
              }`}>
                <div className="flex items-center gap-3 p-3.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    demo.status === 'selected' ? 'bg-green-500 text-white' : 'bg-zinc-800 text-gray-400'
                  }`}>
                    {demo.status === 'selected' ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 font-medium">Demo {idx + 1}</p>
                    {demo.notes && <p className="text-xs text-gray-500 truncate">{demo.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <AudioPreview url={demo.file_url} label={t('listen')} />
                    <Button
                      size="sm"
                      onClick={() => handleSelectDemo(demo.id)}
                      disabled={selectingDemo}
                      className="bg-blue-600 hover:bg-blue-700 text-white h-7 text-xs"
                    >
                      {selectingDemo ? <Loader2 className="w-3 h-3 animate-spin" /> : t('chooseThis')}
                    </Button>
                  </div>
                </div>
                <div className="px-3.5 pb-3.5">
                  <DemoFeedbackPanel
                    demoId={demo.id}
                    musicOrderId={order.id}
                    audioUrl={demo.file_url}
                    demoIndex={idx}
                    overallRating={demo.overall_rating ?? null}
                    overallNotes={demo.overall_notes || ''}
                    onFeedbackSaved={fetchData}
                    tier={order.tier}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isDemoSelectionPhase && (
        <div className="space-y-4">
          <div className="space-y-3">
            {demoBatch.map((demo, idx) => (
              <div key={demo.id} className={`rounded-xl border transition-all ${
                demo.id === order.confirmed_version_id
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-white/[0.03] border-white/[0.07]'
              }`}>
                <div className="flex items-center gap-3 p-3.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    demo.id === order.confirmed_version_id ? 'bg-green-500 text-white' : 'bg-zinc-800 text-gray-400'
                  }`}>
                    {demo.id === order.confirmed_version_id ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 font-medium">Demo {idx + 1}</p>
                    {demo.notes && <p className="text-xs text-gray-500 truncate">{demo.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <AudioPreview url={demo.file_url} label={t('listen')} />
                    {demo.id === order.confirmed_version_id ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                        <CheckCircle2 className="w-3 h-3" /> {t('selected')}
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleSelectDemo(demo.id)}
                        disabled={selectingDemo}
                        className="bg-zinc-700 hover:bg-zinc-600 text-white h-7 text-xs"
                      >
                        {t('switchToThis')}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="px-3.5 pb-3.5">
                  <DemoFeedbackPanel
                    demoId={demo.id}
                    musicOrderId={order.id}
                    audioUrl={demo.file_url}
                    demoIndex={idx}
                    overallRating={demo.overall_rating ?? null}
                    overallNotes={demo.overall_notes || ''}
                    onFeedbackSaved={fetchData}
                    tier={order.tier}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-green-500/10 border border-green-500/25 p-5 space-y-4">
            <div>
              <p className="text-green-400 font-semibold text-sm mb-1">{t('directionSelectedTitle')}</p>
              <p className="text-sm text-gray-400">
                {t('directionSelectedDesc')}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {t('lockWarning')}
            </div>
            <Button
              onClick={handleConfirmDirection}
              disabled={submittingFeedback}
              className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
            >
              {submittingFeedback ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {t('confirmDirectionStart')}
            </Button>
          </div>
        </div>
      )}

      {isRevisionReviewPhase && (
        <div className="space-y-4">
          <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-5 space-y-4">
            <div>
              <p className="text-cyan-400 font-semibold text-sm mb-0.5">
                {t('versionReady', { version: revisionVersions.length })}
              </p>
              <p className="text-sm text-gray-400">
                {t('versionReviewDesc')}
              </p>
            </div>

            {latestRevision.notes && (
              <div className="bg-black/30 rounded-xl px-4 py-3 border border-white/[0.06]">
                <p className="text-xs text-gray-500 mb-1">{t('noteFromProducers')}</p>
                <p className="text-sm text-gray-300">{latestRevision.notes}</p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <AudioPreview url={latestRevision.file_url} label={`Preview V${revisionVersions.length}`} />
              <a
                href={latestRevision.file_url}
                download
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-sm text-gray-300 hover:text-white transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                {t('download')}
              </a>
            </div>

            <DemoFeedbackPanel
              demoId={latestRevision.id}
              musicOrderId={order.id}
              audioUrl={latestRevision.file_url}
              demoIndex={revisionVersions.length - 1}
              overallRating={latestRevision.overall_rating ?? null}
              overallNotes={latestRevision.overall_notes || ''}
              onFeedbackSaved={fetchData}
              onNotesChange={setLiveVersionNotes}
              tier={order.tier}
            />

            <VersionCounter used={versionsUsed} max={order.max_versions} />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button
                onClick={handleConfirmVersion}
                disabled={submittingFeedback}
                className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
              >
                {submittingFeedback ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {t('confirmVersion', { version: revisionVersions.length })}
              </Button>

              {canRequestChanges ? (
                showRevisionForm ? (
                  <div className="col-span-full space-y-3">
                    <p className="text-xs text-gray-500">{t('describeChanges')} <span className="text-red-400">{t('required')}</span></p>
                    <textarea
                      rows={3}
                      placeholder="e.g. 'The second half needs more energy — add more drums and push the bass.'"
                      value={revisionNotes}
                      onChange={(e) => setRevisionNotes(e.target.value)}
                      className="w-full text-sm bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white resize-none focus:outline-none focus:border-blue-500 placeholder:text-gray-600"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSubmitRevision}
                        disabled={submittingRevision || !revisionNotes.trim()}
                        className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                      >
                        {submittingRevision ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        {t('submitRevisionRequest')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setShowRevisionForm(false); setRevisionNotes(''); }}
                        className="border-zinc-700 text-gray-400"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => setShowRevisionForm(true)}
                    className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {t('requestChanges')}
                  </Button>
                )
              ) : (
                <div className="col-span-full flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                  <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{t('versionLimitReached', { max: order.max_versions })}</span>
                </div>
              )}
            </div>
          </div>

          {revisionVersions.length > 1 && (
            <details className="rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <summary className="px-5 py-3 text-sm text-gray-500 cursor-pointer hover:text-white transition-colors list-none flex items-center justify-between">
                <span>{t('allVersions', { count: revisionVersions.length })}</span>
                <span className="text-xs text-gray-600">{t('confirmEarlierVersion')}</span>
              </summary>
              <div className="px-5 pb-5 space-y-3 border-t border-white/[0.05] pt-4">
                {revisionVersions.slice().reverse().map((ver, idx) => {
                  const verNum = revisionVersions.length - idx;
                  const isLatest = ver.id === latestRevision?.id;
                  const isConfirmed = ver.id === order.confirmed_version_id;
                  return (
                    <div key={ver.id} className={`rounded-xl border p-4 space-y-3 ${isConfirmed ? 'bg-green-500/10 border-green-500/25' : 'bg-white/[0.03] border-white/[0.07]'}`}>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={`text-xs ${isConfirmed ? 'border-green-500/30 text-green-400' : 'border-blue-500/30 text-blue-400'}`}>V{verNum}</Badge>
                        <span className="text-xs text-gray-600">{new Date(ver.created_at).toLocaleDateString()}</span>
                        {isLatest && !isConfirmed && <span className="text-[10px] text-cyan-500 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2 py-0.5">{t('latest')}</span>}
                        {isConfirmed && (
                          <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30 gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> {t('confirmed')}
                          </Badge>
                        )}
                        <div className="flex-1" />
                        <AudioPreview url={ver.file_url} label={`Preview V${verNum}`} />
                        {!isLatest && !isConfirmed && (
                          <Button
                            size="sm"
                            onClick={async () => {
                              setSubmittingFeedback(true);
                              try {
                                await supabase.from('music_orders').update({ confirmed_version_id: ver.id, status: 'awaiting_final', awaiting_final_upload: true }).eq('id', order.id);
                                await sendNotification('version_confirmed', order.email, order.order_number, order.id);
                                toast({ title: `V${verNum} confirmed!`, description: 'We will now prepare your final files.' });
                                fetchData();
                                onRefresh();
                              } catch {
                                toast({ title: 'Error', variant: 'destructive' });
                              } finally {
                                setSubmittingFeedback(false);
                              }
                            }}
                            disabled={submittingFeedback}
                            className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
                          >
                            {submittingFeedback ? <Loader2 className="w-3 h-3 animate-spin" /> : `Confirm V${verNum}`}
                          </Button>
                        )}
                      </div>
                      {ver.notes && <p className="text-xs text-gray-400">{ver.notes}</p>}
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      )}

      {isAwaitingFinal && (
        <div className="space-y-4">
          <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-5 space-y-2">
            <div className="flex items-center gap-2 text-orange-400 font-semibold text-sm">
              <Clock className="w-4 h-4" />
              {t('versionConfirmedPreparing')}
            </div>
            <p className="text-sm text-gray-400">
              {t('preparingFinalDesc')}
            </p>
            {confirmedVersion && (
              <div className="flex items-center gap-3 rounded-xl bg-black/30 border border-orange-500/15 px-4 py-3 mt-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 font-medium">
                    {confirmedVersion.version_type === 'demo' ? t('confirmedDirection') : `Confirmed V${confirmedVersionIndex - demoBatch.length + 1}`}
                  </p>
                  {confirmedVersion.notes && <p className="text-xs text-gray-500 truncate">{confirmedVersion.notes}</p>}
                </div>
                <AudioPreview url={confirmedVersion.file_url} label={t('preview')} />
              </div>
            )}
          </div>

          {revisionVersions.length > 1 && (
            <details className="rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <summary className="px-5 py-3 text-sm text-gray-500 cursor-pointer hover:text-white transition-colors list-none flex items-center justify-between">
                <span>{t('changeConfirmedVersion')}</span>
                <span className="text-xs text-gray-600">{t('switchToAnyVersion')}</span>
              </summary>
              <div className="px-5 pb-5 space-y-3 border-t border-white/[0.05] pt-4">
                {revisionVersions.map((ver, idx) => {
                  const verNum = idx + 1;
                  const isConfirmed = ver.id === order.confirmed_version_id;
                  return (
                    <div key={ver.id} className={`rounded-xl border p-4 space-y-3 ${isConfirmed ? 'bg-green-500/10 border-green-500/25' : 'bg-white/[0.03] border-white/[0.07]'}`}>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={`text-xs ${isConfirmed ? 'border-green-500/30 text-green-400' : 'border-blue-500/30 text-blue-400'}`}>V{verNum}</Badge>
                        <span className="text-xs text-gray-600">{new Date(ver.created_at).toLocaleDateString()}</span>
                        {isConfirmed && (
                          <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30 gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> {t('confirmed')}
                          </Badge>
                        )}
                        <div className="flex-1" />
                        <AudioPreview url={ver.file_url} label={`Preview V${verNum}`} />
                        {!isConfirmed && (
                          <Button
                            size="sm"
                            onClick={async () => {
                              setSubmittingFeedback(true);
                              try {
                                await supabase.from('music_orders').update({ confirmed_version_id: ver.id }).eq('id', order.id);
                                toast({ title: `Switched to V${verNum}`, description: 'Your confirmed version has been updated.' });
                                fetchData();
                                onRefresh();
                              } catch {
                                toast({ title: 'Error', variant: 'destructive' });
                              } finally {
                                setSubmittingFeedback(false);
                              }
                            }}
                            disabled={submittingFeedback}
                            className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
                          >
                            {submittingFeedback ? <Loader2 className="w-3 h-3 animate-spin" /> : `Confirm V${verNum}`}
                          </Button>
                        )}
                      </div>
                      {ver.notes && <p className="text-xs text-gray-400">{ver.notes}</p>}
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      )}

      {demos.length > 0 && (
        <details className="rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <summary className="px-5 py-4 text-sm text-gray-400 cursor-pointer hover:text-white transition-colors list-none flex items-center gap-2">
            <Music2 className="w-3.5 h-3.5" />
            {t('versionHistory')} ({t('versionCount', { count: demos.length })})
          </summary>
          <div className="px-5 pb-5 space-y-3 border-t border-white/[0.06] pt-4">
            {demos.map((ver, idx) => (
              <div key={ver.id} className={`rounded-lg p-3.5 border ${
                ver.id === order.confirmed_version_id
                  ? 'bg-green-500/10 border-green-500/25'
                  : 'bg-blue-500/10 border-blue-500/15'
              }`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge variant="outline" className={`text-xs ${ver.id === order.confirmed_version_id ? 'border-green-500/30 text-green-400' : 'border-blue-500/30 text-blue-400'}`}>
                    {ver.version_type === 'revision' ? `Revision ${idx + 1 - demoBatch.length}` : `Demo ${idx + 1}`}
                  </Badge>
                  <span className="text-xs text-gray-600">{new Date(ver.created_at).toLocaleDateString()}</span>
                  {ver.id === order.confirmed_version_id && (
                    <Badge className="text-xs bg-green-500/20 text-green-400 border-green-500/30 gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" /> {t('confirmed')}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-300">{ver.notes || t('noNotes')}</p>
                {ver.file_url && (
                  <div className="flex items-center gap-2 mt-2">
                    <AudioPreview url={ver.file_url} label={t('preview')} />
                    <a href={ver.file_url} download className="text-xs text-blue-400 hover:underline inline-flex items-center gap-1">
                      <Download className="w-3 h-3" /> {t('download')}
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      {order.status === 'completed' && deliverables.length > 0 && (
        <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-5 space-y-4">
          <div className="flex items-center gap-2 text-green-400 font-semibold">
            <CheckCircle2 className="w-5 h-5" />
            {t('musicReady')}
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
                  <a
                    href={deliv.file_url}
                    download
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-400 text-xs font-medium transition-colors"
                  >
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
