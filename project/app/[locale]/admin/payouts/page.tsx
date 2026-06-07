'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DollarSign, Download, CheckCircle, Clock, Filter, RefreshCw, User, ChevronRight, CreditCard, ArrowLeft, Calendar, Wallet, Plus, X, Folder, ChevronDown } from 'lucide-react';

const CHECKLIST_FIELDS = ['contract_filed', 'invoice_sent', 'payment_received', 'talent_paid', 'delivered'] as const;
type ChecklistField = typeof CHECKLIST_FIELDS[number];
const CHECKLIST_LABELS: Record<ChecklistField, string> = {
  contract_filed: '合約已歸檔',
  invoice_sent: '發票已寄出',
  payment_received: '已收款',
  talent_paid: '已付配音員',
  delivered: '已交付客戶',
};

interface Earning {
  id: string;
  talent_id: string;
  order_id: string;
  order_type: string;
  order_number: string;
  tier: string;
  order_total: number;
  commission_rate: number;
  commission_amount: number;
  status: string;
  payout_id: string | null;
  created_at: string;
  cost_breakdown?: Record<string, unknown> | null;
  local_folder_path?: string | null;
  contract_filed?: boolean;
  contract_filed_at?: string | null;
  invoice_sent?: boolean;
  invoice_sent_at?: string | null;
  payment_received?: boolean;
  payment_received_at?: string | null;
  talent_paid?: boolean;
  talent_paid_at?: string | null;
  delivered?: boolean;
  delivered_at?: string | null;
  talents: {
    name: string;
    email: string;
    payment_method?: string | null;
    payment_details?: Record<string, string> | null;
  } | null;
}

interface TalentOption {
  id: string;
  name: string;
  email: string;
}

interface TalentSummary {
  talentId: string;
  name: string;
  email: string;
  totalEarnings: number;
  pendingEarnings: number;
  paidEarnings: number;
  orderCount: number;
  earnings: Earning[];
  paymentMethod: string | null;
  paymentDetails: Record<string, string> | null;
}

function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [{ value: 'all', label: 'All Time' }];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    options.push({ value: val, label });
  }
  return options;
}

function PaymentBadge({ method, details }: { method?: string | null; details?: Record<string, string> | null }) {
  if (!method) return <span className="text-xs text-gray-600">Not set</span>;
  if (method === 'paypal') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
        <Wallet className="w-3 h-3" /> PayPal{details?.paypal_email ? ` · ${details.paypal_email}` : ''}
      </span>
    );
  }
  if (method === 'bank_transfer') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CreditCard className="w-3 h-3" /> Bank{details?.bank_name ? ` · ${details.bank_name}` : ''}
      </span>
    );
  }
  return <span className="text-xs text-gray-500">{method}</span>;
}

export default function PayoutsPage() {
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [view, setView] = useState<'summary' | 'detail' | 'talent'>('summary');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [marking, setMarking] = useState(false);
  const [activeTalent, setActiveTalent] = useState<TalentSummary | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [talentOptions, setTalentOptions] = useState<TalentOption[]>([]);

  const monthOptions = useMemo(() => getMonthOptions(), []);

  const fetchEarnings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/admin/earnings?${params}`);
      const data = await res.json();
      setEarnings(data.earnings || []);
    } catch {
      setEarnings([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchTalents = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/talents');
      const data = await res.json();
      if (Array.isArray(data)) {
        setTalentOptions(data.map((t: { id: string; name: string; email: string }) => ({
          id: t.id, name: t.name, email: t.email,
        })));
      }
    } catch {
      setTalentOptions([]);
    }
  }, []);

  useEffect(() => { fetchEarnings(); }, [fetchEarnings]);
  useEffect(() => { fetchTalents(); }, [fetchTalents]);

  const toggleChecklist = async (id: string, field: ChecklistField, value: boolean) => {
    try {
      const res = await fetch('/api/admin/earnings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, checklist: { [field]: value } }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || '更新失敗');
        return;
      }
      await fetchEarnings();
    } catch {
      alert('更新失敗');
    }
  };

  const filteredEarnings = useMemo(() => {
    if (monthFilter === 'all') return earnings;
    const [year, month] = monthFilter.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    return earnings.filter(e => {
      const d = new Date(e.created_at);
      return d >= start && d < end;
    });
  }, [earnings, monthFilter]);

  const summaries: TalentSummary[] = useMemo(() => {
    const map = new Map<string, TalentSummary>();
    filteredEarnings.forEach(e => {
      const key = e.talent_id;
      if (!map.has(key)) {
        map.set(key, {
          talentId: key,
          name: e.talents?.name || 'Unknown',
          email: e.talents?.email || '',
          totalEarnings: 0,
          pendingEarnings: 0,
          paidEarnings: 0,
          orderCount: 0,
          earnings: [],
          paymentMethod: (e.talents as any)?.payment_method || null,
          paymentDetails: (e.talents as any)?.payment_details || null,
        });
      }
      const s = map.get(key)!;
      s.totalEarnings += e.commission_amount;
      s.orderCount += 1;
      s.earnings.push(e);
      if (e.status === 'pending') s.pendingEarnings += e.commission_amount;
      if (e.status === 'paid') s.paidEarnings += e.commission_amount;
    });
    return Array.from(map.values()).sort((a, b) => b.pendingEarnings - a.pendingEarnings);
  }, [filteredEarnings]);

  const totalPending = summaries.reduce((sum, s) => sum + s.pendingEarnings, 0);
  const totalPaid = summaries.reduce((sum, s) => sum + s.paidEarnings, 0);

  const exportCSV = () => {
    const rows = view === 'summary'
      ? [
          ['Talent', 'Email', 'Orders', 'Pending ($)', 'Paid ($)', 'Total ($)'],
          ...summaries.map(s => [s.name, s.email, s.orderCount, s.pendingEarnings.toFixed(2), s.paidEarnings.toFixed(2), s.totalEarnings.toFixed(2)])
        ]
      : [
          ['Order #', 'Type', 'Tier', 'Talent', 'Order Total ($)', 'Commission Rate', 'Commission ($)', 'Status', 'Date'],
          ...displayedEarnings.map(e => [
            e.order_number, e.order_type, e.tier,
            e.talents?.name || '', e.order_total.toFixed(2),
            (e.commission_rate * 100).toFixed(0) + '%',
            e.commission_amount.toFixed(2), e.status,
            new Date(e.created_at).toLocaleDateString()
          ])
        ];

    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `talent-${view === 'summary' ? 'summary' : 'earnings'}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const displayedEarnings = view === 'talent' && activeTalent
    ? activeTalent.earnings
    : filteredEarnings;

  const pendingEarnings = displayedEarnings.filter(e => e.status === 'pending');
  const selectedPending = Array.from(selected).filter(id => pendingEarnings.some(e => e.id === id));

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPending.length === pendingEarnings.length && pendingEarnings.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pendingEarnings.map(e => e.id)));
    }
  };

  const handleMarkPaid = async (ids?: string[]) => {
    const toMark = ids || selectedPending;
    if (toMark.length === 0) return;
    if (!confirm(`Mark ${toMark.length} earning(s) as paid?`)) return;
    setMarking(true);
    try {
      const res = await fetch('/api/admin/earnings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: toMark, status: 'paid' }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to update');
        return;
      }
      setSelected(new Set());
      setActiveTalent(null);
      setView('summary');
      await fetchEarnings();
    } catch {
      alert('Failed to mark as paid');
    } finally {
      setMarking(false);
    }
  };

  const openTalentDetail = (s: TalentSummary) => {
    setActiveTalent(s);
    setView('talent');
    setSelected(new Set());
  };

  const backToSummary = () => {
    setView('summary');
    setActiveTalent(null);
    setSelected(new Set());
  };

  const checklistCount = (e: Earning) =>
    CHECKLIST_FIELDS.reduce((acc, f) => acc + (e[f] ? 1 : 0), 0);

  const colSpanForExpanded = (showCheckbox: boolean) => {
    let n = 8; // Order, Type, Total, Rate, Commission, Status, Date, Filing
    if (!activeTalent) n += 1; // + Talent column
    if (showCheckbox) n += 1;
    if (!showCheckbox) n += 1; // Action column
    return n;
  };

  const renderEarningsTable = (earningsList: Earning[], showCheckbox: boolean) => (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-600 text-xs uppercase tracking-wider">
            {showCheckbox && (
              <th className="px-3 py-3 w-10">
                <input
                  type="checkbox"
                  checked={selectedPending.length === pendingEarnings.length && pendingEarnings.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded bg-gray-100 border-gray-400"
                />
              </th>
            )}
            <th className="px-5 py-3">Order</th>
            {!activeTalent && <th className="px-5 py-3">Talent</th>}
            <th className="px-5 py-3">Type</th>
            <th className="px-5 py-3">Order Total</th>
            <th className="px-5 py-3">Rate</th>
            <th className="px-5 py-3">Payout</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">Filing</th>
            <th className="px-5 py-3">Date</th>
            {!showCheckbox && <th className="px-5 py-3">Action</th>}
          </tr>
        </thead>
        <tbody>
          {earningsList.map(e => {
            const isExpanded = expandedRowId === e.id;
            const filed = checklistCount(e);
            const isManual = e.order_type === 'manual';
            return (
              <React.Fragment key={e.id}>
                <tr className="border-b border-gray-200/50 hover:bg-gray-100/30">
                  {showCheckbox && (
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(e.id)}
                        onChange={() => toggleSelect(e.id)}
                        disabled={e.status === 'paid'}
                        className="rounded bg-gray-100 border-gray-400 disabled:opacity-30"
                      />
                    </td>
                  )}
                  <td className="px-5 py-3 font-mono text-gray-700 text-xs">
                    #{e.order_number}
                    {isManual && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                        Manual
                      </span>
                    )}
                  </td>
                  {!activeTalent && <td className="px-5 py-3 text-gray-900">{e.talents?.name || '—'}</td>}
                  <td className="px-5 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      {e.order_type} / {e.tier}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-700">US${Number(e.order_total).toFixed(2)}</td>
                  <td className="px-5 py-3 text-gray-600">{(e.commission_rate * 100).toFixed(0)}%</td>
                  <td className="px-5 py-3 text-emerald-700 font-medium">US${Number(e.commission_amount).toFixed(2)}</td>
                  <td className="px-5 py-3">
                    {e.status === 'paid' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                        <CheckCircle className="w-3 h-3" /> Paid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => setExpandedRowId(isExpanded ? null : e.id)}
                      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border transition-colors ${
                        filed === 5
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : filed > 0
                          ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <span className="font-mono">{filed}/5</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </td>
                  <td className="px-5 py-3 text-gray-600 text-xs">
                    {new Date(e.created_at).toLocaleDateString()}
                  </td>
                  {!showCheckbox && (
                    <td className="px-5 py-3">
                      {e.status === 'pending' && (
                        <button
                          onClick={() => handleMarkPaid([e.id])}
                          disabled={marking}
                          className="text-xs px-3 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                        >
                          Mark Paid
                        </button>
                      )}
                    </td>
                  )}
                </tr>
                {isExpanded && (
                  <tr className="bg-gray-50 border-b border-gray-200/50">
                    <td colSpan={colSpanForExpanded(showCheckbox)} className="px-5 py-4">
                      <div className="space-y-3">
                        {e.local_folder_path && (
                          <div className="flex items-center gap-2 text-xs">
                            <Folder className="w-3.5 h-3.5 text-gray-500" />
                            <span className="text-gray-600">本機資料夾:</span>
                            <code className="px-2 py-0.5 bg-white border border-gray-200 rounded text-gray-700 font-mono">
                              ~/Documents/Onyx/Accounting/{e.local_folder_path}
                            </code>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">歸檔進度</p>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            {CHECKLIST_FIELDS.map(field => {
                              const checked = !!e[field];
                              const stamp = e[`${field}_at` as keyof Earning] as string | null | undefined;
                              return (
                                <label
                                  key={field}
                                  className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${
                                    checked
                                      ? 'bg-emerald-50 border-emerald-200'
                                      : 'bg-white border-gray-200 hover:bg-gray-50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(ev) => toggleChecklist(e.id, field, ev.target.checked)}
                                    className="mt-0.5 rounded border-gray-300"
                                  />
                                  <div className="text-xs leading-tight">
                                    <div className={checked ? 'text-emerald-800 font-medium' : 'text-gray-700'}>
                                      {CHECKLIST_LABELS[field]}
                                    </div>
                                    {checked && stamp && (
                                      <div className="text-[10px] text-emerald-600 mt-0.5">
                                        {new Date(stamp).toLocaleDateString()}
                                      </div>
                                    )}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                        {isManual && e.cost_breakdown && Object.keys(e.cost_breakdown).length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">成本拆分(僅你看得到)</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                              {Object.entries(e.cost_breakdown).map(([key, val]) => (
                                <div key={key} className="bg-white border border-gray-200 rounded px-2 py-1.5">
                                  <div className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}</div>
                                  <div className="text-gray-900 font-medium">
                                    {typeof val === 'number' ? `US$${val.toFixed(2)}` : String(val)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-6 md:p-10 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          {view === 'talent' && activeTalent ? (
            <div>
              <button onClick={backToSummary} className="inline-flex items-center gap-1.5 text-gray-600 hover:text-gray-900 text-sm mb-2 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Summary
              </button>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <User className="w-7 h-7 text-emerald-700" />
                {activeTalent.name}
              </h1>
              <p className="text-gray-600 text-sm mt-1">{activeTalent.email} · {activeTalent.orderCount} orders</p>
            </div>
          ) : (
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <DollarSign className="w-7 h-7 text-emerald-700" />
                Talent Payouts
              </h1>
              <p className="text-gray-600 text-sm mt-1">Track commissions and manage talent payments</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchEarnings}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
            title="重新整理"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowManualModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            新增手動分潤
          </button>
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg border border-gray-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      {view !== 'talent' && (
        <div>
          {monthFilter !== 'all' && (
            <p className="text-sm text-cyan-700 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Period: {monthOptions.find(o => o.value === monthFilter)?.label}
              {' '}· {filteredEarnings.length} records
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-gray-600 text-xs uppercase tracking-wider mb-1">
                {monthFilter !== 'all' ? 'Period Pending' : 'Total Pending'}
              </p>
              <p className="text-2xl font-bold text-amber-700">US${totalPending.toFixed(2)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-gray-600 text-xs uppercase tracking-wider mb-1">
                {monthFilter !== 'all' ? 'Period Paid' : 'Total Paid'}
              </p>
              <p className="text-2xl font-bold text-emerald-700">US${totalPaid.toFixed(2)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-gray-600 text-xs uppercase tracking-wider mb-1">Active Talents</p>
              <p className="text-2xl font-bold text-gray-900">{summaries.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* Talent Detail Stats */}
      {view === 'talent' && activeTalent && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-gray-600 text-xs uppercase tracking-wider mb-1">Pending</p>
              <p className="text-xl font-bold text-amber-700">US${activeTalent.pendingEarnings.toFixed(2)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-gray-600 text-xs uppercase tracking-wider mb-1">Paid</p>
              <p className="text-xl font-bold text-emerald-700">US${activeTalent.paidEarnings.toFixed(2)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-gray-600 text-xs uppercase tracking-wider mb-1">Total</p>
              <p className="text-xl font-bold text-gray-900">US${activeTalent.totalEarnings.toFixed(2)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-gray-600 text-xs uppercase tracking-wider mb-1">Commission Rate</p>
              <p className="text-xl font-bold text-cyan-700">
                {activeTalent.earnings[0] ? (activeTalent.earnings[0].commission_rate * 100).toFixed(0) + '%' : '—'}
              </p>
            </div>
          </div>

          {/* Payment Info Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-xs uppercase tracking-wider mb-2">Payment Account</p>
                <PaymentBadge method={activeTalent.paymentMethod} details={activeTalent.paymentDetails} />
                {activeTalent.paymentMethod === 'bank_transfer' && activeTalent.paymentDetails && (
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    {activeTalent.paymentDetails.account_name && (
                      <div><span className="text-gray-500">Name:</span> <span className="text-gray-700">{activeTalent.paymentDetails.account_name}</span></div>
                    )}
                    {activeTalent.paymentDetails.account_number && (
                      <div><span className="text-gray-500">Account:</span> <span className="text-gray-700">{activeTalent.paymentDetails.account_number}</span></div>
                    )}
                    {activeTalent.paymentDetails.bank_code && (
                      <div><span className="text-gray-500">Code:</span> <span className="text-gray-700">{activeTalent.paymentDetails.bank_code}</span></div>
                    )}
                    {activeTalent.paymentDetails.swift_code && (
                      <div><span className="text-gray-500">SWIFT:</span> <span className="text-gray-700">{activeTalent.paymentDetails.swift_code}</span></div>
                    )}
                  </div>
                )}
                {activeTalent.paymentDetails?.notes && (
                  <p className="text-xs text-gray-500 mt-1">{activeTalent.paymentDetails.notes}</p>
                )}
              </div>
              {!activeTalent.paymentMethod && (
                <a href="/admin/talents" className="text-xs text-cyan-700 hover:text-cyan-700 underline">
                  Set in Talent Management
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      {view !== 'talent' && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-white rounded-lg p-1 border border-gray-200">
            <button
              onClick={() => { setView('summary'); setSelected(new Set()); }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === 'summary' ? 'bg-gray-200 text-white' : 'text-gray-600 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5 inline mr-1.5" />
              By Talent
            </button>
            <button
              onClick={() => { setView('detail'); setSelected(new Set()); }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === 'detail' ? 'bg-gray-200 text-white' : 'text-gray-600 hover:text-white'
              }`}
            >
              <Filter className="w-3.5 h-3.5 inline mr-1.5" />
              All Earnings
            </button>
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-white border border-gray-200 text-gray-900 text-sm rounded-lg px-3 py-2"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
          </select>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <select
              value={monthFilter}
              onChange={e => setMonthFilter(e.target.value)}
              className="bg-white border border-gray-200 text-gray-900 text-sm rounded-lg px-3 py-2"
            >
              {monthOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {view === 'detail' && selectedPending.length > 0 && (
            <button
              onClick={() => handleMarkPaid()}
              disabled={marking}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors ml-auto"
            >
              <CheckCircle className="w-4 h-4" />
              {marking ? 'Processing...' : `Mark ${selectedPending.length} as Paid`}
            </button>
          )}
        </div>
      )}

      {/* Talent Detail Actions */}
      {view === 'talent' && activeTalent && activeTalent.pendingEarnings > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleMarkPaid(activeTalent.earnings.filter(e => e.status === 'pending').map(e => e.id))}
            disabled={marking}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            {marking ? 'Processing...' : `Pay All Pending — US$${activeTalent.pendingEarnings.toFixed(2)}`}
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-gray-600">Loading earnings...</div>
      ) : earnings.length === 0 ? (
        <div className="text-center py-16">
          <DollarSign className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-600">No earnings recorded yet</p>
          <p className="text-gray-600 text-sm mt-1">Commissions appear here when orders are completed</p>
        </div>
      ) : view === 'summary' ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-600 text-xs uppercase tracking-wider">
                <th className="px-5 py-3">Talent</th>
                <th className="px-5 py-3">Payment</th>
                <th className="px-5 py-3">Orders</th>
                <th className="px-5 py-3">Pending</th>
                <th className="px-5 py-3">Paid</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map(s => (
                <tr key={s.talentId} className="border-b border-gray-200/50 hover:bg-gray-100/30 group">
                  <td className="px-5 py-3">
                    <p className="text-gray-900 font-medium">{s.name}</p>
                    <p className="text-gray-500 text-xs">{s.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <PaymentBadge method={s.paymentMethod} details={s.paymentDetails} />
                  </td>
                  <td className="px-5 py-3 text-gray-700">{s.orderCount}</td>
                  <td className="px-5 py-3">
                    {s.pendingEarnings > 0 ? (
                      <span className="text-amber-700 font-medium">US${s.pendingEarnings.toFixed(2)}</span>
                    ) : (
                      <span className="text-gray-600">US$0.00</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-emerald-700">US${s.paidEarnings.toFixed(2)}</td>
                  <td className="px-5 py-3 text-gray-900 font-semibold">US${s.totalEarnings.toFixed(2)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openTalentDetail(s)}
                        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 hover:text-gray-900 hover:bg-gray-200 border border-gray-300 transition-colors"
                      >
                        View <ChevronRight className="w-3 h-3" />
                      </button>
                      {s.pendingEarnings > 0 && (
                        <button
                          onClick={() => handleMarkPaid(s.earnings.filter(e => e.status === 'pending').map(e => e.id))}
                          disabled={marking}
                          className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                        >
                          <CreditCard className="w-3 h-3" /> Pay
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : view === 'detail' ? (
        renderEarningsTable(earnings, true)
      ) : (
        renderEarningsTable(activeTalent?.earnings || [], false)
      )}

      {showManualModal && (
        <ManualEntryModal
          talentOptions={talentOptions}
          onClose={() => setShowManualModal(false)}
          onCreated={async () => {
            setShowManualModal(false);
            await fetchEarnings();
          }}
        />
      )}
    </div>
  );
}

function ManualEntryModal({
  talentOptions,
  onClose,
  onCreated,
}: {
  talentOptions: TalentOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [talentId, setTalentId] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [realTotal, setRealTotal] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [marketing, setMarketing] = useState('');
  const [platformFee, setPlatformFee] = useState('');
  const [operations, setOperations] = useState('');
  const [other, setOther] = useState('');
  const [notes, setNotes] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const talent = talentOptions.find(t => t.id === talentId);
  const suggestedFolderPath = useMemo(() => {
    if (!orderNumber) return '';
    const year = new Date().getFullYear();
    const talentSlug = talent?.name?.replace(/\s+/g, '_') || 'Talent';
    return `${year}/Cases/Case_${orderNumber}_${talentSlug}`;
  }, [orderNumber, talent]);

  const effectiveFolderPath = folderPath || suggestedFolderPath;

  const sumBreakdown =
    (Number(marketing) || 0) +
    (Number(platformFee) || 0) +
    (Number(operations) || 0) +
    (Number(other) || 0) +
    (Number(payoutAmount) || 0);
  const realTotalNum = Number(realTotal) || 0;
  const breakdownMismatch =
    realTotalNum > 0 && Math.abs(sumBreakdown - realTotalNum) > 0.01;

  const handleSubmit = async () => {
    setError(null);
    if (!talentId) return setError('請選配音員');
    if (!orderNumber.trim()) return setError('請輸入 Order Number');
    if (!realTotal || realTotalNum <= 0) return setError('Real total 要大於 0');
    if (!payoutAmount || Number(payoutAmount) <= 0) return setError('Talent payout 要大於 0');

    setSaving(true);
    try {
      const costBreakdown: Record<string, number | string> = {};
      if (marketing) costBreakdown.marketing = Number(marketing);
      if (platformFee) costBreakdown.platform_fee = Number(platformFee);
      if (operations) costBreakdown.operations = Number(operations);
      if (other) costBreakdown.other = Number(other);
      if (notes.trim()) costBreakdown.notes = notes.trim();

      const res = await fetch('/api/admin/earnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderType: 'manual',
          talentId,
          orderNumber: orderNumber.trim(),
          realTotal: Number(realTotal),
          payoutAmount: Number(payoutAmount),
          costBreakdown,
          localFolderPath: effectiveFolderPath || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '建立失敗');
        return;
      }
      onCreated();
    } catch {
      setError('建立失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">新增手動分潤</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              線下/離平台案子。Real total 跟 talent payout 可以不一樣 — 中間差額放成本拆分,配音員看不到。
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">配音員 *</label>
              <select
                value={talentId}
                onChange={(e) => setTalentId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">-- 選 --</option>
                {talentOptions.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Order Number *</label>
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="MANUAL-2026-001"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Real Client Total (US$) *</label>
              <input
                type="number"
                step="0.01"
                value={realTotal}
                onChange={(e) => setRealTotal(e.target.value)}
                placeholder="3000000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
              />
              <p className="text-[10px] text-gray-500 mt-1">客戶真正付的金額,配音員看不到</p>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Talent Payout (US$) *</label>
              <input
                type="number"
                step="0.01"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="300000"
                className="w-full border border-emerald-300 rounded-lg px-3 py-2 text-sm font-mono bg-emerald-50"
              />
              <p className="text-[10px] text-emerald-700 mt-1">配音員實拿(他看得到的)</p>
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">成本拆分(差額去哪)</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Marketing</label>
                <input
                  type="number"
                  step="0.01"
                  value={marketing}
                  onChange={(e) => setMarketing(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Platform Fee</label>
                <input
                  type="number"
                  step="0.01"
                  value={platformFee}
                  onChange={(e) => setPlatformFee(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Operations</label>
                <input
                  type="number"
                  step="0.01"
                  value={operations}
                  onChange={(e) => setOperations(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Other</label>
                <input
                  type="number"
                  step="0.01"
                  value={other}
                  onChange={(e) => setOther(e.target.value)}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs font-mono"
                />
              </div>
            </div>
            <div className="mt-2">
              <label className="block text-[10px] text-gray-500 mb-1">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. 跟 X 公司簽 3 年獨家,中間經過 Y agency"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
              />
            </div>
            {realTotalNum > 0 && (
              <p className={`text-[11px] mt-2 ${breakdownMismatch ? 'text-amber-700' : 'text-emerald-700'}`}>
                Payout + breakdown = US${sumBreakdown.toFixed(2)} / Real total = US${realTotalNum.toFixed(2)}
                {breakdownMismatch && ` (差 US$${(realTotalNum - sumBreakdown).toFixed(2)},記得補)`}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">本機資料夾路徑</label>
            <div className="flex items-center gap-2">
              <code className="text-xs text-gray-500 whitespace-nowrap">~/Documents/Onyx/Accounting/</code>
              <input
                type="text"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                placeholder={suggestedFolderPath || '自動建議'}
                className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs font-mono"
              />
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              你拖合約/發票/水單到這個資料夾,然後上面 5 個 checkbox 自己勾。空白會用自動建議。
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? '建立中...' : '建立分潤紀錄'}
          </button>
        </div>
      </div>
    </div>
  );
}
