'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Search, Filter, RefreshCw, Mail, Send, Clock,
  CheckCircle, MessageSquare, ChevronDown, ChevronUp,
  X, User, ArrowRight, Eye,
} from 'lucide-react';

interface Reply {
  message: string;
  sentAt: string;
  messageId?: string;
}

interface Inquiry {
  id: string;
  inquiry_number: string;
  name: string;
  email: string;
  message: string;
  department: string;
  source: string;
  status: 'new' | 'read' | 'replied' | 'closed';
  assigned_to: string | null;
  notes: string | null;
  replies: Reply[];
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  new: { label: 'New', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: Mail },
  read: { label: 'Read', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', icon: Eye },
  replied: { label: 'Replied', color: 'bg-green-500/20 text-green-300 border-green-500/30', icon: CheckCircle },
  closed: { label: 'Closed', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: X },
};

const DEPT_CONFIG: Record<string, { label: string; color: string }> = {
  HELLO: { label: 'Hello', color: 'text-emerald-400' },
  PRODUCTION: { label: 'Production', color: 'text-cyan-400' },
  SUPPORT: { label: 'Support', color: 'text-amber-400' },
  BILLING: { label: 'Billing', color: 'text-purple-400' },
  ADMIN: { label: 'Admin', color: 'text-red-400' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.new;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon size={12} />
      {cfg.label}
    </span>
  );
}

function DeptBadge({ department }: { department: string }) {
  const cfg = DEPT_CONFIG[department] || DEPT_CONFIG.HELLO;
  return (
    <span className={`text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDept, setFilterDept] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [internalNotes, setInternalNotes] = useState<Record<string, string>>({});
  const [newCount, setNewCount] = useState(0);

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterDept !== 'all') params.set('department', filterDept);

      const res = await fetch(`/api/admin/inquiries?${params}`);
      const data = await res.json();
      if (data.inquiries) {
        setInquiries(data.inquiries);
        setNewCount(data.newCount || 0);
        const notesMap: Record<string, string> = {};
        data.inquiries.forEach((inq: Inquiry) => {
          notesMap[inq.id] = inq.notes || '';
        });
        setInternalNotes(notesMap);
      }
    } catch {
      toast.error('Failed to load inquiries');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterDept]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch('/api/admin/inquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setInquiries((prev) =>
        prev.map((inq) => (inq.id === id ? { ...inq, status: newStatus as Inquiry['status'] } : inq))
      );
      toast.success(`Status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleSaveNotes = async (id: string) => {
    try {
      const res = await fetch('/api/admin/inquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, notes: internalNotes[id] || '' }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Notes saved');
    } catch {
      toast.error('Failed to save notes');
    }
  };

  const handleReply = async (inquiry: Inquiry) => {
    if (!replyText.trim()) {
      toast.error('Please enter a reply message.');
      return;
    }
    setReplying(true);
    try {
      const res = await fetch('/api/admin/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: inquiry.id, replyMessage: replyText }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to send reply');

      const newReply: Reply = { message: replyText, sentAt: new Date().toISOString() };
      setInquiries((prev) =>
        prev.map((inq) =>
          inq.id === inquiry.id
            ? { ...inq, status: 'replied', replies: [...(inq.replies || []), newReply] }
            : inq
        )
      );
      setReplyText('');
      toast.success(`Reply sent to ${inquiry.email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reply');
    } finally {
      setReplying(false);
    }
  };

  const handleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setReplyText('');
    } else {
      setExpandedId(id);
      setReplyText('');
      const inq = inquiries.find((i) => i.id === id);
      if (inq && inq.status === 'new') {
        handleStatusChange(id, 'read');
      }
    }
  };

  const filtered = inquiries.filter((inq) => {
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return (
        inq.inquiry_number.toLowerCase().includes(s) ||
        inq.name.toLowerCase().includes(s) ||
        inq.email.toLowerCase().includes(s) ||
        inq.message.toLowerCase().includes(s)
      );
    }
    return true;
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Inquiries</h1>
          <p className="text-gray-400 text-sm mt-1">
            {newCount > 0 ? (
              <span className="text-blue-400 font-medium">{newCount} new</span>
            ) : (
              'All caught up'
            )}
            {' · '}{inquiries.length} total
          </p>
        </div>
        <button
          onClick={fetchInquiries}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, reference..."
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="pl-9 pr-8 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white appearance-none cursor-pointer focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="read">Read</option>
              <option value="replied">Replied</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white appearance-none cursor-pointer focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All Departments</option>
            <option value="HELLO">Hello</option>
            <option value="PRODUCTION">Production</option>
            <option value="SUPPORT">Support</option>
            <option value="BILLING">Billing</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
      </div>

      {/* Inquiry List */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading inquiries...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <MessageSquare size={48} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400 text-lg font-medium">No inquiries found</p>
          <p className="text-gray-400 text-sm mt-1">
            {searchTerm ? 'Try a different search term.' : 'Inquiries will appear here when customers reach out.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inq) => {
            const isExpanded = expandedId === inq.id;
            return (
              <div
                key={inq.id}
                className={`bg-zinc-900/50 border rounded-xl transition-all duration-200 ${
                  inq.status === 'new'
                    ? 'border-blue-500/30 bg-blue-500/[0.03]'
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {/* Summary Row */}
                <button
                  onClick={() => handleExpand(inq.id)}
                  className="w-full flex items-center gap-4 p-4 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs font-mono text-gray-400">{inq.inquiry_number}</span>
                      <StatusBadge status={inq.status} />
                      <DeptBadge department={inq.department} />
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-white truncate">{inq.name}</span>
                      <span className="text-xs text-gray-400">&lt;{inq.email}&gt;</span>
                    </div>
                    <p className="text-sm text-gray-400 truncate">{inq.message}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-gray-400">{timeAgo(inq.created_at)}</span>
                    {inq.replies && inq.replies.length > 0 && (
                      <span className="text-xs text-green-400 flex items-center gap-1">
                        <Send size={10} /> {inq.replies.length}
                      </span>
                    )}
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-zinc-800 p-5 space-y-5">
                    {/* Info Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Reference</p>
                        <p className="text-sm font-mono text-emerald-400">{inq.inquiry_number}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Source</p>
                        <p className="text-sm text-white capitalize">{inq.source.replace(/-/g, ' ')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Submitted</p>
                        <p className="text-sm text-white">
                          {new Date(inq.created_at).toLocaleString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Status</p>
                        <select
                          value={inq.status}
                          onChange={(e) => handleStatusChange(inq.id, e.target.value)}
                          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
                        >
                          <option value="new">New</option>
                          <option value="read">Read</option>
                          <option value="replied">Replied</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>
                    </div>

                    {/* Client Message */}
                    <div>
                      <p className="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
                        <User size={12} /> Client Message
                      </p>
                      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                        <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{inq.message}</p>
                      </div>
                    </div>

                    {/* Previous Replies */}
                    {inq.replies && inq.replies.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
                          <Send size={12} /> Reply History ({inq.replies.length})
                        </p>
                        <div className="space-y-2">
                          {inq.replies.map((reply, idx) => (
                            <div key={idx} className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-emerald-400 font-medium">Sent by team</span>
                                <span className="text-xs text-gray-400">
                                  {new Date(reply.sentAt).toLocaleString('en-US', {
                                    month: 'short', day: 'numeric',
                                    hour: '2-digit', minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <p className="text-sm text-gray-200 whitespace-pre-wrap">{reply.message}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reply Composer */}
                    <div>
                      <p className="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
                        <ArrowRight size={12} /> Reply to {inq.name}
                      </p>
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={`Write your reply to ${inq.name}...`}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-4 text-sm text-white placeholder:text-gray-400 focus:border-blue-500 focus:outline-none resize-none min-h-[120px]"
                        disabled={replying}
                      />
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-xs text-gray-400">
                          Will be sent from <span className="text-gray-400">{DEPT_CONFIG[inq.department]?.label || inq.department}</span> as a branded Onyx email
                        </p>
                        <button
                          onClick={() => handleReply(inq)}
                          disabled={replying || !replyText.trim()}
                          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                        >
                          {replying ? (
                            <RefreshCw size={14} className="animate-spin" />
                          ) : (
                            <Send size={14} />
                          )}
                          Send Reply
                        </button>
                      </div>
                    </div>

                    {/* Internal Notes */}
                    <div className="border-t border-zinc-800 pt-4">
                      <p className="text-xs text-gray-400 mb-2">Internal Notes (not visible to client)</p>
                      <textarea
                        value={internalNotes[inq.id] || ''}
                        onChange={(e) => setInternalNotes({ ...internalNotes, [inq.id]: e.target.value })}
                        placeholder="Add internal notes..."
                        className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3 text-sm text-gray-300 placeholder:text-gray-600 focus:border-zinc-600 focus:outline-none resize-none min-h-[60px]"
                      />
                      <button
                        onClick={() => handleSaveNotes(inq.id)}
                        className="mt-2 px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs font-medium text-gray-300 transition-colors"
                      >
                        Save Notes
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
