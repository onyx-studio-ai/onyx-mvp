'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Mic, Music, Search, Filter, RefreshCw, Play, Pause,
  ChevronDown, ChevronUp, Download, Check, Clock, Eye, Trash2,
  XCircle, User, Globe, Settings, DollarSign, FileAudio,
  Calendar, Phone, Mail
} from 'lucide-react';
import { AdminHeader, AdminStats } from '@/components/admin/list-ui';

interface LinkedTalent {
  id: string;
  name: string;
  is_active: boolean;
  voice_id_status: string | null;
}

interface Application {
  id: string;
  application_number: string;
  role_type: 'VO' | 'Singer';
  full_name: string;
  email: string;
  phone: string;
  country: string;
  // /apply/talent (new form) fields
  display_name?: string;
  messaging_contacts?: { line?: string; whatsapp?: string; telegram?: string };
  coop_accept_jobs?: boolean;
  coop_open_buyout?: boolean;
  coop_ai_clone?: boolean;
  coop_ai_training?: boolean;
  coop_proofread?: boolean;
  coop_voice_director?: boolean;
  low_price_data_optin?: boolean;
  excluded_countries?: string[];
  locale?: string;
  languages: string[];
  gender: string;
  age_range: string;
  voice_types: string[];
  specialties: string[];
  experience_years: string;
  notable_clients: string;
  bio: string;
  has_home_studio: boolean;
  microphone_model: string;
  daw_software: string;
  recording_environment: string;
  can_deliver_dry_audio: boolean;
  expected_rate_voice: number | null;
  expected_rate_music: number | null;
  rate_lead_vocal: number | null;
  rate_hook_chorus: number | null;
  rate_currency: string;
  rate_notes: string;
  demo_file_url: string;
  demo_file_name: string;
  demo_file_size: number;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  admin_notes: string;
  reviewed_by: string;
  reviewed_at: string | null;
  created_at: string;
  talent_id: string | null;
  talents: LinkedTalent | null;
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  under_review: { label: 'Under Review', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  approved: { label: 'Approved', color: 'bg-green-50 text-green-700 border-green-200' },
  rejected: { label: 'Rejected', color: 'bg-red-50 text-red-700 border-red-200' },
};

function StatusBadge({ status }: { status: Application['status'] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function formatFileSize(bytes: number) {
  if (!bytes) return '—';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// 顯示文字走 i18n:t 由呼叫端傳入,只換文字不動時間計算。
function timeAgo(dateStr: string, t: ReturnType<typeof useTranslations>) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('timeJustNow');
  if (mins < 60) return t('timeMinsAgo', { mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('timeHoursAgo', { hrs });
  return t('timeDaysAgo', { days: Math.floor(hrs / 24) });
}

function AudioPlayer({ url, fileName }: { url: string; fileName: string }) {
  const t = useTranslations('admin.applications');
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play(); setPlaying(true); }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-300">
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={e => {
          const a = e.currentTarget;
          if (a.duration) setProgress((a.currentTime / a.duration) * 100);
        }}
        onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
      />
      <button
        onClick={toggle}
        className="w-9 h-9 flex-shrink-0 rounded-full bg-amber-500 hover:bg-amber-400 flex items-center justify-center transition-colors"
      >
        {playing ? <Pause className="w-4 h-4 text-black" /> : <Play className="w-4 h-4 text-black ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-700 truncate font-mono">{fileName}</p>
        <div className="mt-1.5 h-1 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        {duration > 0 && <p className="text-xs text-gray-500 mt-1">{Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}</p>}
      </div>
      <a
        href={url}
        download={fileName}
        className="flex-shrink-0 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
        title={t('download')}
      >
        <Download className="w-4 h-4" />
      </a>
    </div>
  );
}

function ApplicationRow({ app, onStatusChange }: { app: Application; onStatusChange: () => void }) {
  const t = useTranslations('admin.applications');
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState(app.admin_notes || '');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejReasons, setRejReasons] = useState<string[]>([]);
  const [savingNotes, setSavingNotes] = useState(false);

  const updateStatus = async (status: Application['status'], reasons?: string[]) => {
    if (status === 'approved') {
      const ok = window.confirm(
        t('approveConfirm', { name: app.full_name, email: app.email })
      );
      if (!ok) return;
    }
    // 拒絕改由「勾原因」彈窗觸發(見下方 modal),勾選的原因一併帶入拒絕信。
    setUpdating(true);
    try {
      const res = await fetch('/api/admin/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: app.id, status, reviewed_at: new Date().toISOString(), ...(status === 'rejected' && reasons?.length ? { reasons } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t('toastUpdateFail'));
      } else {
        if (status === 'approved') {
          toast.success(t('toastApproved', { email: app.email }));
        } else if (status === 'rejected') {
          toast.success(t('toastRejected', { email: app.email }));
        } else {
          toast.success(t('toastStatusUpdated', { status: STATUS_CONFIG[status].label }));
        }
        onStatusChange();
      }
    } catch {
      toast.error(t('toastNetworkError'));
    }
    setUpdating(false);
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    const res = await fetch('/api/admin/applications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: app.id, admin_notes: notes }),
    });
    if (!res.ok) toast.error(t('toastNotesFail'));
    else toast.success(t('toastNotesSaved'));
    setSavingNotes(false);
  };

  const deleteApplication = async () => {
    const ok = window.confirm(
      t('deleteConfirm', { name: app.full_name || '', number: app.application_number || app.id })
    );
    if (!ok) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/applications?id=${app.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || t('toastDeleteFail'));
      } else {
        toast.success(t('toastDeleted'));
        onStatusChange();
      }
    } catch {
      toast.error(t('toastNetworkError'));
    }
    setUpdating(false);
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Row Header */}
      <div
        className="flex items-center gap-4 px-5 py-4 hover:bg-white/50 cursor-pointer transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-shrink-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            app.role_type === 'Singer' ? 'bg-blue-50' : 'bg-amber-50'
          }`}>
            {app.role_type === 'Singer'
              ? <Music className="w-5 h-5 text-blue-700" />
              : <Mic className="w-5 h-5 text-amber-700" />
            }
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900">{app.full_name}</p>
            <span className="text-xs text-gray-500 font-mono">{app.application_number}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${app.locale ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>{app.locale ? t('sourceTalent') : t('sourceAiVoice')}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-600 flex-wrap">
            <span>{app.email}</span>
            <span>·</span>
            <span>{app.country}</span>
            <span>·</span>
            <span>{app.languages.slice(0, 2).join(', ')}{app.languages.length > 2 ? ` +${app.languages.length - 2}` : ''}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <StatusBadge status={app.status} />
          {app.talents && (
            <a
              href={`/admin/talents?highlight=${app.talents.id}`}
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-cyan-50 text-cyan-700 border border-cyan-500/25 hover:bg-cyan-500/25 transition-colors"
              title={t('talentTooltip', { voiceId: app.talents.voice_id_status || 'none', active: app.talents.is_active ? t('yes') : t('no') })}
            >
              <Eye className="w-3 h-3" />
              {t('talentBadge')}
              {app.talents.is_active ? (
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
              )}
            </a>
          )}
          <span className="text-xs text-gray-500 hidden sm:block">{timeAgo(app.created_at, t)}</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
        </div>
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-gray-200 px-5 py-6 space-y-6 bg-white/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Left Column */}
            <div className="space-y-5">
              {/* Basic Info */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> {t('sectionBasicInfo')}
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <a href={`mailto:${app.email}`} className="hover:text-gray-900 transition-colors">{app.email}</a>
                  </div>
                  {app.phone && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <Phone className="w-4 h-4 text-gray-500" />
                      {app.phone}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-gray-700">
                    <Globe className="w-4 h-4 text-gray-500" />
                    {app.country} · {app.gender} · {t('ageLabel')} {app.age_range}
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    {new Date(app.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Voice Profile */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5" /> {t('sectionVoiceProfile')}
                </h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">{t('fieldLanguages')} </span>
                    <span className="text-gray-900">{app.languages.join(', ')}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('fieldVoiceTypes')} </span>
                    <span className="text-gray-900">{app.voice_types.join(', ')}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('fieldSpecialties')} </span>
                    <span className="text-gray-900">{app.specialties.join(', ')}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('fieldExperience')} </span>
                    <span className="text-gray-900">{app.experience_years}</span>
                  </div>
                  {app.notable_clients && (
                    <div>
                      <span className="text-gray-500">{t('fieldNotableClients')} </span>
                      <span className="text-gray-900">{app.notable_clients}</span>
                    </div>
                  )}
                  {app.bio && (
                    <div>
                      <span className="text-gray-500 block mb-1">{t('fieldBio')}</span>
                      <p className="text-gray-700 text-xs leading-relaxed">{app.bio}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Technical */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5" /> {t('sectionTechnical')}
                </h4>
                <div className="space-y-2 text-sm">
                  {/* Home Studio / Dry Audio are only asked on the old /apply/voice form.
                      The new talent form (has locale) doesn't collect them, so they'd show
                      misleading DB defaults — hide them there; rely on Environment instead. */}
                  {!app.locale && (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">{t('fieldHomeStudio')}</span>
                        <span className={app.has_home_studio ? 'text-green-700' : 'text-red-700'}>
                          {app.has_home_studio ? t('yes') : t('no')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">{t('fieldDryAudio')}</span>
                        <span className={app.can_deliver_dry_audio ? 'text-green-700' : 'text-red-700'}>
                          {app.can_deliver_dry_audio ? t('yes') : t('no')}
                        </span>
                      </div>
                    </>
                  )}
                  {app.microphone_model && <div><span className="text-gray-500">{t('fieldMic')} </span><span className="text-gray-900">{app.microphone_model}</span></div>}
                  {app.daw_software && <div><span className="text-gray-500">{t('fieldDaw')} </span><span className="text-gray-900">{app.daw_software}</span></div>}
                  <div><span className="text-gray-500">{t('fieldEnvironment')} </span><span className="text-gray-900">{app.recording_environment}</span></div>
                </div>
              </div>

              {/* 配音員報名表（新表單 /apply/talent)專屬欄位 */}
              {app.locale && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> {t('sectionTalentForm')}
                  </h4>
                  <div className="space-y-2 text-sm">
                    {app.display_name && <div><span className="text-gray-500">{t('fieldDisplayName')} </span><span className="text-gray-900">{app.display_name}</span></div>}
                    {app.messaging_contacts && (app.messaging_contacts.line || app.messaging_contacts.whatsapp || app.messaging_contacts.telegram) && (
                      <div><span className="text-gray-500">{t('fieldMessaging')} </span><span className="text-gray-900">{[app.messaging_contacts.line && `Line: ${app.messaging_contacts.line}`, app.messaging_contacts.whatsapp && `WhatsApp: ${app.messaging_contacts.whatsapp}`, app.messaging_contacts.telegram && `Telegram: ${app.messaging_contacts.telegram}`].filter(Boolean).join(' · ')}</span></div>
                    )}
                    <div><span className="text-gray-500">{t('fieldCoop')} </span><span className="text-gray-900">{[app.coop_accept_jobs && t('coopAcceptJobs'), app.coop_open_buyout && t('coopOpenBuyout'), app.coop_ai_clone && t('coopAiClone'), app.coop_ai_training && t('coopAiTraining'), app.coop_proofread && t('coopProofread'), app.coop_voice_director && t('coopVoiceDirector')].filter(Boolean).join(t('listSeparator')) || t('dash')}</span></div>
                    <div><span className="text-gray-500">{t('fieldLowPriceData')} </span><span className="text-gray-900">{app.low_price_data_optin ? t('lowPriceYes') : t('lowPriceNo')}</span></div>
                    {app.excluded_countries && app.excluded_countries.length > 0 && <div><span className="text-gray-500">{t('fieldExcludedCountries')} </span><span className="text-gray-900">{app.excluded_countries.join(t('listSeparator'))}</span></div>}
                    <div><span className="text-gray-500">{t('fieldFormLocale')} </span><span className="text-gray-900">{app.locale}</span></div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-5">
              {/* Demo Audio */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <FileAudio className="w-3.5 h-3.5" /> {t('sectionDemoAudio')}
                </h4>
                {app.demo_file_url ? (
                  <div className="space-y-2">
                    <AudioPlayer url={app.demo_file_url} fileName={app.demo_file_name || 'demo.wav'} />
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{app.demo_file_name}</span>
                      <span>{formatFileSize(app.demo_file_size)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">{t('noFileUploaded')}</p>
                )}
              </div>

              {/* Rates */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" /> {t('sectionExpectedRates')}
                </h4>
                <div className="space-y-1.5 text-sm">
                  {(app.rate_lead_vocal || app.expected_rate_voice) && (
                    <div><span className="text-gray-500">{t('rateLeadVocal')} </span><span className="text-gray-900">US${(app.rate_lead_vocal ?? app.expected_rate_voice)?.toLocaleString()}</span></div>
                  )}
                  {(app.rate_hook_chorus || app.expected_rate_music) && (
                    <div><span className="text-gray-500">{t('rateHookChorus')} </span><span className="text-gray-900">US${(app.rate_hook_chorus ?? app.expected_rate_music)?.toLocaleString()}</span></div>
                  )}
                  {!app.rate_lead_vocal && !app.expected_rate_voice && !app.rate_hook_chorus && !app.expected_rate_music && (
                    <p className="text-gray-500">{t('notSpecified')}</p>
                  )}
                  {app.rate_notes && <p className="text-gray-700 text-xs mt-1">{app.rate_notes}</p>}
                </div>
              </div>

              {/* Admin Notes */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">{t('sectionAdminNotes')}</h4>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder={t('notesPlaceholder')}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-300 focus:outline-none transition-colors resize-none"
                />
                <button
                  onClick={saveNotes}
                  disabled={savingNotes}
                  className="mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {savingNotes ? t('saving') : t('saveNotes')}
                </button>
              </div>

              {/* Linked Talent Status */}
              {app.talents && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> {t('sectionLinkedTalent')}
                  </h4>
                  <div className="p-3 bg-white rounded-lg border border-gray-300 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">{t('linkedName')}</span>
                      <span className="text-gray-900 font-medium">{app.talents.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">{t('linkedActive')}</span>
                      <span className={app.talents.is_active ? 'text-green-700' : 'text-gray-500'}>
                        {app.talents.is_active ? t('yes') : t('no')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">{t('linkedVoiceId')}</span>
                      <span className={
                        app.talents.voice_id_status === 'verified' ? 'text-green-700' :
                        app.talents.voice_id_status === 'submitted' ? 'text-blue-700' :
                        app.talents.voice_id_status === 'requested' ? 'text-amber-700' : 'text-gray-500'
                      }>
                        {app.talents.voice_id_status || t('linkedVoiceIdNone')}
                      </span>
                    </div>
                    <a
                      href={`/admin/talents?highlight=${app.talents.id}`}
                      className="block mt-2 text-center text-xs text-cyan-700 hover:text-cyan-700 bg-cyan-50 hover:bg-cyan-50 rounded-lg py-2 transition-colors"
                    >
                      {t('viewInTalentMgmt')}
                    </a>
                  </div>
                </div>
              )}

              {/* Status Actions */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">{t('sectionUpdateStatus')}</h4>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(STATUS_CONFIG) as Application['status'][]).map(s => (
                    <button
                      key={s}
                      onClick={() => (s === 'rejected' ? (setRejReasons([]), setRejectOpen(true)) : updateStatus(s))}
                      disabled={updating || app.status === s}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all disabled:cursor-not-allowed ${
                        app.status === s
                          ? `${STATUS_CONFIG[s].color} opacity-100 cursor-default`
                          : 'bg-gray-100 border-gray-300 text-gray-700 hover:border-gray-500 hover:text-gray-900 opacity-80 hover:opacity-100'
                      }`}
                    >
                      {app.status === s && <Check className="inline w-3 h-3 mr-1" />}
                      {STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>
                {rejectOpen && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50/50 p-3">
                    <p className="text-xs font-semibold text-gray-700 mb-2">{t('rejectTitle')}</p>
                    {([['audio', t('rejectAudio')], ['gear', t('rejectGear')], ['proof', t('rejectProof')]] as [string, string][]).map(([code, label]) => (
                      <label key={code} className="flex items-center gap-2 text-xs text-gray-700 mb-1.5">
                        <input type="checkbox" checked={rejReasons.includes(code)} onChange={(e) => setRejReasons((prev) => e.target.checked ? [...prev, code] : prev.filter((x) => x !== code))} />
                        {label}
                      </label>
                    ))}
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => { updateStatus('rejected', rejReasons); setRejectOpen(false); }} disabled={updating} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">{t('rejectConfirm')}</button>
                      <button onClick={() => setRejectOpen(false)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600">{t('cancel')}</button>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1.5">{t('rejectHint')}</p>
                  </div>
                )}
              </div>

              {/* Delete */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={deleteApplication}
                  disabled={updating}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" /> {t('deleteApplication')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminApplicationsPage() {
  const t = useTranslations('admin.applications');
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'VO' | 'Singer'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | Application['status']>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'talent' | 'voice'>('all');

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/applications');
    if (!res.ok) {
      toast.error(t('toastLoadFail'));
    } else {
      const data = await res.json();
      setApplications(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  const filtered = applications.filter(a => {
    if (roleFilter !== 'all' && a.role_type !== roleFilter) return false;
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (sourceFilter === 'talent' && !a.locale) return false;
    if (sourceFilter === 'voice' && a.locale) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.full_name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || a.application_number.toLowerCase().includes(q);
    }
    return true;
  });

  const counts = {
    total: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    under_review: applications.filter(a => a.status === 'under_review').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
    singers: applications.filter(a => a.role_type === 'Singer').length,
    vo: applications.filter(a => a.role_type === 'VO').length,
  };

  return (
    <div className="p-6 lg:p-8">
      <AdminHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={(
          <button
            onClick={fetchApplications}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </button>
        )}
      />

      <AdminStats items={[
        { label: t('statTotal'), value: counts.total },
        { label: t('statPending'), value: counts.pending, color: 'text-yellow-700' },
        { label: t('statReviewing'), value: counts.under_review, color: 'text-blue-700' },
        { label: t('statApproved'), value: counts.approved, color: 'text-green-700' },
        { label: t('statRejected'), value: counts.rejected, color: 'text-red-700' },
        { label: t('statSingers'), value: counts.singers, color: 'text-blue-700' },
        { label: t('statVoiceActors'), value: counts.vo, color: 'text-amber-700' },
      ]} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-300 focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value as typeof roleFilter)}
            className="bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:border-amber-300 focus:outline-none"
          >
            <option value="all">{t('roleAll')}</option>
            <option value="VO">{t('roleVO')}</option>
            <option value="Singer">{t('roleSinger')}</option>
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
            className="bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:border-amber-300 focus:outline-none"
          >
            <option value="all">{t('statusAll')}</option>
            <option value="pending">{t('statusPending')}</option>
            <option value="under_review">{t('statusUnderReview')}</option>
            <option value="approved">{t('statusApproved')}</option>
            <option value="rejected">{t('statusRejected')}</option>
          </select>
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value as typeof sourceFilter)}
            className="bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:border-amber-300 focus:outline-none"
          >
            <option value="all">{t('sourceAll')}</option>
            <option value="talent">{t('sourceTalentNew')}</option>
            <option value="voice">{t('sourceVoiceOld')}</option>
          </select>
        </div>
      </div>

      {/* Applications List */}
      {loading ? (
        <div className="text-center py-16">
          <RefreshCw className="w-8 h-8 text-gray-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-500">{t('loadingApplications')}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-gray-200 rounded-xl">
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mx-auto mb-4">
            <Filter className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-gray-600 font-medium">{t('noApplications')}</p>
          <p className="text-gray-600 text-sm mt-1">
            {applications.length === 0 ? t('noApplicationsHint') : t('adjustFilters')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(app => (
            <ApplicationRow key={app.id} app={app} onStatusChange={fetchApplications} />
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-center text-xs text-gray-600 mt-6">
          {t('showingCount', { shown: filtered.length, total: applications.length })}
        </p>
      )}
    </div>
  );
}
