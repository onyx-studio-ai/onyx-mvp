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
import { useTranslations, useLocale } from 'next-intl';
import { daysUntilAutoApprove, formatAutoApproveDate } from '@/lib/auto-approve';
import ReviewBox from '@/components/marketplace/ReviewBox';
import { groupByUploadDate } from '@/lib/deliveries';

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
  talent_id?: string | null; // present = real-person casting order (no team "final-prep" step)
  download_url?: string | null; // delivered file when no voice_order_versions row exists (legacy/casting deliveries)
}

// URLs stored from older deliveries can carry stray whitespace/newlines (a trailing
// newline on the SUPABASE_URL env var) — strip it so the link actually works.
const cleanUrl = (u?: string | null) => (u || '').replace(/\s/g, '');

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
  const tAi = useTranslations('ai.disclosure');
  const locale = useLocale();
  const tc = useTranslations('common');
  // EU AI Act 50(4):有指派配音員或 tier-3 = 真人錄音,不標;其餘(tier-1/tier-2)交付檔為 AI 生成
  //(判準與 lib/mail-templates.ts 的 voiceMode 一致:hasTalent 優先於 tier)。
  const isAiDeliverable = !order.talent_id && order.tier !== 'tier-3';
  const [versions, setVersions] = useState<Version[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  // 交付後 7 天自動完成的倒數 + 客戶自行延期(Wing 2026-08-20)
  const [autoAt, setAutoAt] = useState<string | null>((order as { auto_approve_at?: string | null }).auto_approve_at ?? null);
  const [extending, setExtending] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [showRevisionForm, setShowRevisionForm] = useState(false);

  const maxRev = order.max_revisions ?? 2;
  const usedRev = order.revision_count ?? 0;
  const unlimitedRev = maxRev >= 99; // talent offered unlimited revisions (sentinel 999)
  const canRequestChanges = unlimitedRev || usedRev < maxRev;
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
  // 一張單可能是「多支不同影片」(照護系列 12 支、A422 講解 7 支),不是同一支的多版。
  // 舊寫法 reviewVersionNo = versions.length 把「檔案數」當「版本數」,12 支的單會跟客戶說
  // 「第 13 版」,像是我們來回改了十幾次(2026-08-20 Wing 指出)。
  const fileNames = [...new Set(versions.map((v) => v.file_name))];
  const isMultiFile = fileNames.length > 1;
  // 真正的版次 = 同一個檔名最多被交過幾次
  const roundNo = Math.max(1, ...fileNames.map((n) => versions.filter((v) => v.file_name === n).length));
  // Casting (real-person) orders skip the team "final-prep" step — drop it so the
  // progress bar reads delivered → completed instead of leaving step 4 blank.
  const steps = order.talent_id ? VOICE_STATUS_STEPS.filter((s) => s.key !== 'awaiting_final') : VOICE_STATUS_STEPS;
  const currentStep = Math.max(0, steps.findIndex((s) => s.key === order.status));
  // The file to review: the latest uploaded version, or — for legacy/casting
  // deliveries that never created a version row — the order's download_url.
  const reviewUrl = cleanUrl(latestVersion?.file_url) || cleanUrl(order.download_url);
  const reviewVersionNo = roundNo;   // 單檔案案沿用「第 N 版」;多檔案案改用檔案數文案(見下方)
  // 交付檔按上傳日期分組(新到舊)。最新那批 = 這次要審的整批檔(可能多個)。
  const groupedVersions = groupByUploadDate(versions, (v) => v.created_at);
  const latestBatch = groupedVersions[0]?.items || [];

  // Approve / request-revision run server-side (service role) — browser writes to
  // voice_orders are RLS-blocked (silent no-op), and a casting revision must reach
  // the TALENT, not the order email. See /api/client/orders/[id]/review.
  const review = async (action: 'approve' | 'revise', feedback?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/client/orders/${order.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: JSON.stringify({ action, feedback }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || t('operationFailed'));
  };

  const handleExtendReview = async () => {
    setExtending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/client/orders/${order.id}/extend-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || t('extendReviewFail'));
      setAutoAt(j.auto_approve_at);
      toast({ title: t('extendReviewDone', { date: formatAutoApproveDate(j.auto_approve_at) }) });
      onRefresh();
    } catch (err: unknown) {
      toast({ title: tc('error'), description: err instanceof Error ? err.message : t('extendReviewFail'), variant: 'destructive' });
    } finally {
      setExtending(false);
    }
  };

  const handleApproveVersion = async () => {
    if (!reviewUrl) return;
    setSubmitting(true);
    try {
      await review('approve');
      toast({ title: t('versionApproved'), description: t('versionApprovedDesc') });
      fetchData();
      onRefresh();
    } catch (err: unknown) {
      toast({ title: tc('error'), description: err instanceof Error ? err.message : t('operationFailed'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!revisionNotes.trim()) {
      toast({ title: t('describeChangesNeeded'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await review('revise', revisionNotes.trim());
      setRevisionNotes('');
      setShowRevisionForm(false);
      toast({ title: t('revisionRequestSentTitle'), description: t('revisionRequestSentDesc') });
      fetchData();
      onRefresh();
    } catch (err: unknown) {
      toast({ title: tc('error'), description: err instanceof Error ? err.message : t('operationFailed'), variant: 'destructive' });
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
          {steps.map((step, idx) => {
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
                {idx < steps.length - 1 && (
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
            {unlimitedRev ? (
              <span className="font-semibold">♾ {locale === 'en' ? 'Unlimited revisions' : locale === 'zh-CN' ? '无限修改' : '無限修改'}{usedRev > 0 ? `　${locale === 'en' ? `used ${usedRev}` : `已用 ${usedRev}`}` : ''}</span>
            ) : !canRequestChanges ? (
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
              : isMultiFile
                ? t('deliveryInProduction')
                : t('workingOnVersion', { version: roundNo + 1 })
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

      {/* Delivered — Review (works even when the delivery has no version row yet) */}
      {order.status === 'delivered' && reviewUrl && (
        <div className="space-y-4">
          <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-5 space-y-4">
            <div>
              <p className="text-cyan-400 font-semibold text-sm mb-0.5">
                {isMultiFile ? t('filesReady', { count: latestBatch.length || fileNames.length }) : t('versionReady', { version: reviewVersionNo })}
              </p>
              <p className="text-sm text-gray-400">
                {t('versionReviewDesc')}
              </p>
            </div>

            {latestVersion?.notes && (
              <div className="bg-black/30 rounded-xl px-4 py-3 border border-white/[0.06]">
                <p className="text-xs text-gray-500 mb-1">{t('noteFromTeam')}</p>
                <p className="text-sm text-gray-300">{latestVersion.notes}</p>
              </div>
            )}

            {/* 最新一批交付的所有檔(可能多個);每個都能試聽 / 下載。整批一起核准 / 要求修改。 */}
            <div className="space-y-2">
              {(latestBatch.length
                ? latestBatch.map((v) => ({ id: v.id, url: cleanUrl(v.file_url), name: v.file_name }))
                : [{ id: '_single', url: reviewUrl, name: `${t('preview')} V${reviewVersionNo}` }]
              ).map((f) => (
                <div key={f.id} className="flex items-center gap-3">
                  <AudioPreview url={f.url} label={f.name} />
                  <a href={f.url} download
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-sm text-gray-300 hover:text-white transition-all shrink-0">
                    <Download className="w-3.5 h-3.5" />
                    {t('download')}
                  </a>
                </div>
              ))}
            </div>

            {/* EU AI Act 50(4):AI 交付檔的揭露告知(客戶=發布方,義務在他,附做法) */}
            {isAiDeliverable && (
              <p className="text-xs text-gray-300 leading-relaxed border-t border-white/10 pt-3">
                {tAi('delivery')}
              </p>
            )}

            {/* 交付後 7 天自動完成的倒數 + 延期(Wing 2026-08-20:有客戶拿了檔案就忘記回來按確認,
                配音員的錢一直卡著。有這條倒數與延期鈕,自動完成才站得住腳)。 */}
            {(() => {
              const left = daysUntilAutoApprove(autoAt);
              if (left === null) return null;   // 平台自營案不設倒數
              return (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 flex items-start gap-3 flex-wrap">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-[180px]">
                    <p className="text-sm text-amber-200 font-medium">
                      {left <= 0 ? t('autoCompleteToday') : t('autoCompleteNotice', { days: left, date: formatAutoApproveDate(autoAt) })}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{t('autoCompleteHint')}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleExtendReview} disabled={extending}
                    className="border-amber-500/40 text-amber-200 hover:bg-amber-500/10 shrink-0">
                    {extending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('extendReview')}
                  </Button>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button onClick={handleApproveVersion} disabled={submitting} className="w-full bg-green-600 hover:bg-green-700 text-white gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {isMultiFile ? t('approveDelivery', { count: latestBatch.length || fileNames.length }) : t('approveVersion', { version: reviewVersionNo })}
              </Button>

              {canRequestChanges ? (
                showRevisionForm ? (
                  <div className="col-span-full space-y-3">
                    <p className="text-xs text-gray-500">{t('describeChanges')}</p>
                    <textarea
                      rows={3}
                      placeholder={t('revisionPlaceholder')}
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
                        {tc('cancel')}
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
          <div className="px-5 pb-5 space-y-4 border-t border-white/[0.06] pt-4">
            {/* 依上傳日期分組(新到舊);每組一個日期標題,下面列出那天的檔。 */}
            {groupedVersions.map((g) => (
              <div key={g.key} className="space-y-2">
                <p className="text-xs font-medium text-gray-400">{g.date ? g.date.toLocaleDateString() : ''}</p>
                {g.items.slice().reverse().map((ver) => {
                  const isApproved = ver.status === 'approved';
                  return (
                    <div key={ver.id} className={`rounded-lg p-3.5 border ${
                      isApproved ? 'bg-green-500/10 border-green-500/25' : 'bg-cyan-500/10 border-cyan-500/15'
                    }`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant="outline" className={`text-xs ${isApproved ? 'border-green-500/30 text-green-400' : 'border-cyan-500/30 text-cyan-400'}`}>
                          V{ver.version_number}
                        </Badge>
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
                          <AudioPreview url={cleanUrl(ver.file_url)} label={t('preview')} />
                          <a href={cleanUrl(ver.file_url)} download className="text-xs text-blue-400 hover:underline inline-flex items-center gap-1">
                            <Download className="w-3 h-3" /> {t('download')}
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
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

          {/* EU AI Act 50(4):AI 交付檔的揭露告知(客戶=發布方,義務在他,附做法) */}
          {isAiDeliverable && (
            <p className="text-xs text-gray-300 leading-relaxed border-t border-white/10 pt-3">
              {tAi('delivery')}
            </p>
          )}
        </div>
      )}

      {/* Completed (casting/real-person) — no separate deliverables, the talent's
          approved file IS the final. Show it for download. */}
      {order.status === 'completed' && deliverables.length === 0 && reviewUrl && (
        <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-5 space-y-4">
          <div className="flex items-center gap-2 text-green-400 font-semibold">
            <CheckCircle2 className="w-5 h-5" />
            {t('voiceoverReady')}
          </div>
          <p className="text-sm text-gray-400">{t('allFinalFiles')}</p>
          <div className="flex items-center gap-3">
            <AudioPreview url={reviewUrl} label={t('preview')} />
            <a href={reviewUrl} download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-400 text-xs font-medium transition-colors">
              <Download className="w-3.5 h-3.5" />
              {t('download')}
            </a>
          </div>
        </div>
      )}

      {/* Rate the talent once the order is complete */}
      {order.status === 'completed' && <ReviewBox orderId={order.id} myType="client" />}
    </div>
  );
}
