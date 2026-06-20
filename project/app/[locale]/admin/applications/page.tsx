'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  Mic, Music, Search, Filter, RefreshCw, Play, Pause,
  ChevronDown, ChevronUp, Download, Check, Clock, Eye, Trash2,
  XCircle, User, Globe, Settings, DollarSign, FileAudio,
  Calendar, Phone, Mail
} from 'lucide-react';

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

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function AudioPlayer({ url, fileName }: { url: string; fileName: string }) {
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
        title="Download"
      >
        <Download className="w-4 h-4" />
      </a>
    </div>
  );
}

function ApplicationRow({ app, onStatusChange }: { app: Application; onStatusChange: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState(app.admin_notes || '');
  const [savingNotes, setSavingNotes] = useState(false);

  const updateStatus = async (status: Application['status']) => {
    if (status === 'approved') {
      const ok = window.confirm(
        `Approve ${app.full_name}?\n\nThis will:\n• Send approval email to ${app.email}\n• Create a talent record in the system\n• The email will include next-step instructions (contract signing + Voice ID recording)`
      );
      if (!ok) return;
    }
    if (status === 'rejected') {
      const ok = window.confirm(
        `Reject ${app.full_name}'s application?\n\nA polite rejection email will be sent to ${app.email}.`
      );
      if (!ok) return;
    }
    setUpdating(true);
    try {
      const res = await fetch('/api/admin/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: app.id, status, reviewed_at: new Date().toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to update status');
      } else {
        if (status === 'approved') {
          toast.success(`Approved! Onboarding email sent to ${app.email}`);
        } else if (status === 'rejected') {
          toast.success(`Rejected. Notification sent to ${app.email}`);
        } else {
          toast.success(`Status updated to ${STATUS_CONFIG[status].label}`);
        }
        onStatusChange();
      }
    } catch {
      toast.error('Network error');
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
    if (!res.ok) toast.error('Failed to save notes');
    else toast.success('Notes saved');
    setSavingNotes(false);
  };

  const deleteApplication = async () => {
    const ok = window.confirm(
      `Delete this application — ${app.full_name || ''} (${app.application_number || app.id})?\n\nThis permanently removes the application record. It cannot be undone.`
    );
    if (!ok) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/applications?id=${app.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Failed to delete application');
      } else {
        toast.success('Application deleted');
        onStatusChange();
      }
    } catch {
      toast.error('Network error');
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
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${app.locale ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>{app.locale ? '配音員報名' : 'AI / 語音'}</span>
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
              title={`Voice ID: ${app.talents.voice_id_status || 'none'} | Active: ${app.talents.is_active ? 'Yes' : 'No'}`}
            >
              <Eye className="w-3 h-3" />
              Talent
              {app.talents.is_active ? (
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
              )}
            </a>
          )}
          <span className="text-xs text-gray-500 hidden sm:block">{timeAgo(app.created_at)}</span>
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
                  <User className="w-3.5 h-3.5" /> Basic Info
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
                    {app.country} · {app.gender} · Age {app.age_range}
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
                  <Mic className="w-3.5 h-3.5" /> Voice Profile
                </h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">Languages: </span>
                    <span className="text-gray-900">{app.languages.join(', ')}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Voice Types: </span>
                    <span className="text-gray-900">{app.voice_types.join(', ')}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Specialties: </span>
                    <span className="text-gray-900">{app.specialties.join(', ')}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Experience: </span>
                    <span className="text-gray-900">{app.experience_years}</span>
                  </div>
                  {app.notable_clients && (
                    <div>
                      <span className="text-gray-500">Notable Clients: </span>
                      <span className="text-gray-900">{app.notable_clients}</span>
                    </div>
                  )}
                  {app.bio && (
                    <div>
                      <span className="text-gray-500 block mb-1">Bio:</span>
                      <p className="text-gray-700 text-xs leading-relaxed">{app.bio}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Technical */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5" /> Technical Setup
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Home Studio:</span>
                    <span className={app.has_home_studio ? 'text-green-700' : 'text-red-700'}>
                      {app.has_home_studio ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Dry Audio:</span>
                    <span className={app.can_deliver_dry_audio ? 'text-green-700' : 'text-red-700'}>
                      {app.can_deliver_dry_audio ? 'Yes' : 'No'}
                    </span>
                  </div>
                  {app.microphone_model && <div><span className="text-gray-500">Mic: </span><span className="text-gray-900">{app.microphone_model}</span></div>}
                  {app.daw_software && <div><span className="text-gray-500">DAW: </span><span className="text-gray-900">{app.daw_software}</span></div>}
                  <div><span className="text-gray-500">Environment: </span><span className="text-gray-900">{app.recording_environment}</span></div>
                </div>
              </div>

              {/* 配音員報名表（新表單 /apply/talent)專屬欄位 */}
              {app.locale && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> 配音員報名表（新)
                  </h4>
                  <div className="space-y-2 text-sm">
                    {app.display_name && <div><span className="text-gray-500">顯示名稱(公開): </span><span className="text-gray-900">{app.display_name}</span></div>}
                    {app.messaging_contacts && (app.messaging_contacts.line || app.messaging_contacts.whatsapp || app.messaging_contacts.telegram) && (
                      <div><span className="text-gray-500">通訊軟體: </span><span className="text-gray-900">{[app.messaging_contacts.line && `Line: ${app.messaging_contacts.line}`, app.messaging_contacts.whatsapp && `WhatsApp: ${app.messaging_contacts.whatsapp}`, app.messaging_contacts.telegram && `Telegram: ${app.messaging_contacts.telegram}`].filter(Boolean).join(' · ')}</span></div>
                    )}
                    <div><span className="text-gray-500">合作意願: </span><span className="text-gray-900">{[app.coop_accept_jobs && '接案配音', app.coop_open_buyout && '開放買斷', app.coop_ai_clone && 'AI複製(會用聲音)', app.coop_ai_training && 'AI訓練(不用聲音)', app.coop_proofread && '語音校對'].filter(Boolean).join('、') || '—'}</span></div>
                    <div><span className="text-gray-500">低價數據採集案: </span><span className="text-gray-900">{app.low_price_data_optin ? '願意收資訊' : '否'}</span></div>
                    {app.excluded_countries && app.excluded_countries.length > 0 && <div><span className="text-gray-500">不接案國家: </span><span className="text-gray-900">{app.excluded_countries.join('、')}</span></div>}
                    <div><span className="text-gray-500">表單語言: </span><span className="text-gray-900">{app.locale}</span></div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-5">
              {/* Demo Audio */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <FileAudio className="w-3.5 h-3.5" /> Demo Audio
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
                  <p className="text-sm text-gray-500">No file uploaded</p>
                )}
              </div>

              {/* Rates */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" /> Expected Rates
                </h4>
                <div className="space-y-1.5 text-sm">
                  {(app.rate_lead_vocal || app.expected_rate_voice) && (
                    <div><span className="text-gray-500">Lead Vocal (Full Buyout): </span><span className="text-gray-900">US${(app.rate_lead_vocal ?? app.expected_rate_voice)?.toLocaleString()}</span></div>
                  )}
                  {(app.rate_hook_chorus || app.expected_rate_music) && (
                    <div><span className="text-gray-500">Hook / Chorus (Buyout): </span><span className="text-gray-900">US${(app.rate_hook_chorus ?? app.expected_rate_music)?.toLocaleString()}</span></div>
                  )}
                  {!app.rate_lead_vocal && !app.expected_rate_voice && !app.rate_hook_chorus && !app.expected_rate_music && (
                    <p className="text-gray-500">Not specified</p>
                  )}
                  {app.rate_notes && <p className="text-gray-700 text-xs mt-1">{app.rate_notes}</p>}
                </div>
              </div>

              {/* Admin Notes */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Admin Notes</h4>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Internal notes about this applicant..."
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-300 focus:outline-none transition-colors resize-none"
                />
                <button
                  onClick={saveNotes}
                  disabled={savingNotes}
                  className="mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {savingNotes ? 'Saving...' : 'Save Notes'}
                </button>
              </div>

              {/* Linked Talent Status */}
              {app.talents && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Linked Talent
                  </h4>
                  <div className="p-3 bg-white rounded-lg border border-gray-300 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Name</span>
                      <span className="text-gray-900 font-medium">{app.talents.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Active</span>
                      <span className={app.talents.is_active ? 'text-green-700' : 'text-gray-500'}>
                        {app.talents.is_active ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Voice ID</span>
                      <span className={
                        app.talents.voice_id_status === 'verified' ? 'text-green-700' :
                        app.talents.voice_id_status === 'submitted' ? 'text-blue-700' :
                        app.talents.voice_id_status === 'requested' ? 'text-amber-700' : 'text-gray-500'
                      }>
                        {app.talents.voice_id_status || 'None'}
                      </span>
                    </div>
                    <a
                      href={`/admin/talents?highlight=${app.talents.id}`}
                      className="block mt-2 text-center text-xs text-cyan-700 hover:text-cyan-700 bg-cyan-50 hover:bg-cyan-50 rounded-lg py-2 transition-colors"
                    >
                      View in Talent Management →
                    </a>
                  </div>
                </div>
              )}

              {/* Status Actions */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Update Status</h4>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(STATUS_CONFIG) as Application['status'][]).map(s => (
                    <button
                      key={s}
                      onClick={() => updateStatus(s)}
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
              </div>

              {/* Delete */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={deleteApplication}
                  disabled={updating}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete application
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
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'VO' | 'Singer'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | Application['status']>('all');

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/applications');
    if (!res.ok) {
      toast.error('Failed to load applications');
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
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Talent Applications</h1>
          <p className="text-gray-600 text-sm mt-1">Review and manage incoming talent submissions</p>
        </div>
        <button
          onClick={fetchApplications}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        {[
          { label: 'Total', value: counts.total, color: 'text-gray-900' },
          { label: 'Pending', value: counts.pending, color: 'text-yellow-700' },
          { label: 'Reviewing', value: counts.under_review, color: 'text-blue-700' },
          { label: 'Approved', value: counts.approved, color: 'text-green-700' },
          { label: 'Rejected', value: counts.rejected, color: 'text-red-700' },
          { label: 'Singers', value: counts.singers, color: 'text-blue-700' },
          { label: 'Voice Actors', value: counts.vo, color: 'text-amber-700' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, or application number..."
            className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-300 focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value as typeof roleFilter)}
            className="bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:border-amber-300 focus:outline-none"
          >
            <option value="all">All Roles</option>
            <option value="VO">Voice Actors</option>
            <option value="Singer">Singers</option>
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
            className="bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:border-amber-300 focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Applications List */}
      {loading ? (
        <div className="text-center py-16">
          <RefreshCw className="w-8 h-8 text-gray-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Loading applications...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-gray-200 rounded-xl">
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mx-auto mb-4">
            <Filter className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-gray-600 font-medium">No applications found</p>
          <p className="text-gray-600 text-sm mt-1">
            {applications.length === 0 ? 'Applications will appear here once submitted via /apply' : 'Try adjusting your filters'}
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
          Showing {filtered.length} of {applications.length} applications
        </p>
      )}
    </div>
  );
}
