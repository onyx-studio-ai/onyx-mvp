'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  Mic, Music, Search, Filter, RefreshCw, Play, Pause,
  ChevronDown, ChevronUp, Download, Check, Clock, Eye,
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
  pending: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  under_review: { label: 'Under Review', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  approved: { label: 'Approved', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
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
    <div className="flex items-center gap-3 p-3 bg-zinc-900 rounded-lg border border-zinc-700">
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
        <p className="text-xs text-gray-300 truncate font-mono">{fileName}</p>
        <div className="mt-1.5 h-1 bg-zinc-700 rounded-full overflow-hidden">
          <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        {duration > 0 && <p className="text-xs text-gray-500 mt-1">{Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}</p>}
      </div>
      <a
        href={url}
        download={fileName}
        className="flex-shrink-0 p-2 text-gray-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
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

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden">
      {/* Row Header */}
      <div
        className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-900/50 cursor-pointer transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-shrink-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            app.role_type === 'Singer' ? 'bg-blue-500/20' : 'bg-amber-500/20'
          }`}>
            {app.role_type === 'Singer'
              ? <Music className="w-5 h-5 text-blue-400" />
              : <Mic className="w-5 h-5 text-amber-400" />
            }
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-white">{app.full_name}</p>
            <span className="text-xs text-gray-500 font-mono">{app.application_number}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
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
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 hover:bg-cyan-500/25 transition-colors"
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
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-zinc-800 px-5 py-6 space-y-6 bg-zinc-950/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Left Column */}
            <div className="space-y-5">
              {/* Basic Info */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Basic Info
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-300">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <a href={`mailto:${app.email}`} className="hover:text-white transition-colors">{app.email}</a>
                  </div>
                  {app.phone && (
                    <div className="flex items-center gap-2 text-gray-300">
                      <Phone className="w-4 h-4 text-gray-500" />
                      {app.phone}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-gray-300">
                    <Globe className="w-4 h-4 text-gray-500" />
                    {app.country} · {app.gender} · Age {app.age_range}
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
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
                    <span className="text-gray-200">{app.languages.join(', ')}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Voice Types: </span>
                    <span className="text-gray-200">{app.voice_types.join(', ')}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Specialties: </span>
                    <span className="text-gray-200">{app.specialties.join(', ')}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Experience: </span>
                    <span className="text-gray-200">{app.experience_years}</span>
                  </div>
                  {app.notable_clients && (
                    <div>
                      <span className="text-gray-500">Notable Clients: </span>
                      <span className="text-gray-200">{app.notable_clients}</span>
                    </div>
                  )}
                  {app.bio && (
                    <div>
                      <span className="text-gray-500 block mb-1">Bio:</span>
                      <p className="text-gray-300 text-xs leading-relaxed">{app.bio}</p>
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
                    <span className={app.has_home_studio ? 'text-green-400' : 'text-red-400'}>
                      {app.has_home_studio ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Dry Audio:</span>
                    <span className={app.can_deliver_dry_audio ? 'text-green-400' : 'text-red-400'}>
                      {app.can_deliver_dry_audio ? 'Yes' : 'No'}
                    </span>
                  </div>
                  {app.microphone_model && <div><span className="text-gray-500">Mic: </span><span className="text-gray-200">{app.microphone_model}</span></div>}
                  {app.daw_software && <div><span className="text-gray-500">DAW: </span><span className="text-gray-200">{app.daw_software}</span></div>}
                  <div><span className="text-gray-500">Environment: </span><span className="text-gray-200">{app.recording_environment}</span></div>
                </div>
              </div>
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
                    <div><span className="text-gray-500">Lead Vocal (Full Buyout): </span><span className="text-gray-200">US${(app.rate_lead_vocal ?? app.expected_rate_voice)?.toLocaleString()}</span></div>
                  )}
                  {(app.rate_hook_chorus || app.expected_rate_music) && (
                    <div><span className="text-gray-500">Hook / Chorus (Buyout): </span><span className="text-gray-200">US${(app.rate_hook_chorus ?? app.expected_rate_music)?.toLocaleString()}</span></div>
                  )}
                  {!app.rate_lead_vocal && !app.expected_rate_voice && !app.rate_hook_chorus && !app.expected_rate_music && (
                    <p className="text-gray-500">Not specified</p>
                  )}
                  {app.rate_notes && <p className="text-gray-300 text-xs mt-1">{app.rate_notes}</p>}
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
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-amber-500/60 focus:outline-none transition-colors resize-none"
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
                  <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Name</span>
                      <span className="text-white font-medium">{app.talents.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Active</span>
                      <span className={app.talents.is_active ? 'text-green-400' : 'text-gray-500'}>
                        {app.talents.is_active ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Voice ID</span>
                      <span className={
                        app.talents.voice_id_status === 'verified' ? 'text-green-400' :
                        app.talents.voice_id_status === 'submitted' ? 'text-blue-400' :
                        app.talents.voice_id_status === 'requested' ? 'text-amber-400' : 'text-gray-500'
                      }>
                        {app.talents.voice_id_status || 'None'}
                      </span>
                    </div>
                    <a
                      href={`/admin/talents?highlight=${app.talents.id}`}
                      className="block mt-2 text-center text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg py-2 transition-colors"
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
                          : 'bg-zinc-800 border-zinc-600 text-gray-200 hover:border-zinc-500 hover:text-white opacity-80 hover:opacity-100'
                      }`}
                    >
                      {app.status === s && <Check className="inline w-3 h-3 mr-1" />}
                      {STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>
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
          <h1 className="text-2xl font-bold text-white">Talent Applications</h1>
          <p className="text-gray-400 text-sm mt-1">Review and manage incoming talent submissions</p>
        </div>
        <button
          onClick={fetchApplications}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        {[
          { label: 'Total', value: counts.total, color: 'text-white' },
          { label: 'Pending', value: counts.pending, color: 'text-yellow-400' },
          { label: 'Reviewing', value: counts.under_review, color: 'text-blue-400' },
          { label: 'Approved', value: counts.approved, color: 'text-green-400' },
          { label: 'Rejected', value: counts.rejected, color: 'text-red-400' },
          { label: 'Singers', value: counts.singers, color: 'text-blue-300' },
          { label: 'Voice Actors', value: counts.vo, color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
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
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-amber-500/60 focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value as typeof roleFilter)}
            className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-amber-500/60 focus:outline-none"
          >
            <option value="all">All Roles</option>
            <option value="VO">Voice Actors</option>
            <option value="Singer">Singers</option>
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
            className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-amber-500/60 focus:outline-none"
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
        <div className="text-center py-16 border border-zinc-800 rounded-xl">
          <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mx-auto mb-4">
            <Filter className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-gray-400 font-medium">No applications found</p>
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
