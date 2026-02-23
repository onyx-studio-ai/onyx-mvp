'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DollarSign, Download, CheckCircle, Clock, Filter, RefreshCw, User, ChevronRight, CreditCard, ArrowLeft, Calendar, Wallet } from 'lucide-react';

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
  talents: {
    name: string;
    email: string;
    payment_method?: string | null;
    payment_details?: Record<string, string> | null;
  } | null;
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
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
        <Wallet className="w-3 h-3" /> PayPal{details?.paypal_email ? ` · ${details.paypal_email}` : ''}
      </span>
    );
  }
  if (method === 'bank_transfer') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
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

  useEffect(() => { fetchEarnings(); }, [fetchEarnings]);

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

  const renderEarningsTable = (earningsList: Earning[], showCheckbox: boolean) => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-gray-400 text-xs uppercase tracking-wider">
            {showCheckbox && (
              <th className="px-3 py-3 w-10">
                <input
                  type="checkbox"
                  checked={selectedPending.length === pendingEarnings.length && pendingEarnings.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded bg-zinc-800 border-zinc-600"
                />
              </th>
            )}
            <th className="px-5 py-3">Order</th>
            {!activeTalent && <th className="px-5 py-3">Talent</th>}
            <th className="px-5 py-3">Type</th>
            <th className="px-5 py-3">Order Total</th>
            <th className="px-5 py-3">Rate</th>
            <th className="px-5 py-3">Commission</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">Date</th>
            {!showCheckbox && <th className="px-5 py-3">Action</th>}
          </tr>
        </thead>
        <tbody>
          {earningsList.map(e => (
            <tr key={e.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
              {showCheckbox && (
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(e.id)}
                    onChange={() => toggleSelect(e.id)}
                    disabled={e.status === 'paid'}
                    className="rounded bg-zinc-800 border-zinc-600 disabled:opacity-30"
                  />
                </td>
              )}
              <td className="px-5 py-3 font-mono text-gray-300 text-xs">#{e.order_number}</td>
              {!activeTalent && <td className="px-5 py-3 text-white">{e.talents?.name || '—'}</td>}
              <td className="px-5 py-3">
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {e.order_type} / {e.tier}
                </span>
              </td>
              <td className="px-5 py-3 text-gray-300">US${Number(e.order_total).toFixed(2)}</td>
              <td className="px-5 py-3 text-gray-400">{(e.commission_rate * 100).toFixed(0)}%</td>
              <td className="px-5 py-3 text-emerald-400 font-medium">US${Number(e.commission_amount).toFixed(2)}</td>
              <td className="px-5 py-3">
                {e.status === 'paid' ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                    <CheckCircle className="w-3 h-3" /> Paid
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                    <Clock className="w-3 h-3" /> Pending
                  </span>
                )}
              </td>
              <td className="px-5 py-3 text-gray-400 text-xs">
                {new Date(e.created_at).toLocaleDateString()}
              </td>
              {!showCheckbox && (
                <td className="px-5 py-3">
                  {e.status === 'pending' && (
                    <button
                      onClick={() => handleMarkPaid([e.id])}
                      disabled={marking}
                      className="text-xs px-3 py-1 rounded-md bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/40 disabled:opacity-50 transition-colors"
                    >
                      Mark Paid
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
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
              <button onClick={backToSummary} className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-sm mb-2 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Summary
              </button>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <User className="w-7 h-7 text-emerald-400" />
                {activeTalent.name}
              </h1>
              <p className="text-gray-400 text-sm mt-1">{activeTalent.email} · {activeTalent.orderCount} orders</p>
            </div>
          ) : (
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <DollarSign className="w-7 h-7 text-emerald-400" />
                Talent Payouts
              </h1>
              <p className="text-gray-400 text-sm mt-1">Track commissions and manage talent payments</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchEarnings}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg transition-colors"
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
            <p className="text-sm text-cyan-400 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Period: {monthOptions.find(o => o.value === monthFilter)?.label}
              {' '}· {filteredEarnings.length} records
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">
                {monthFilter !== 'all' ? 'Period Pending' : 'Total Pending'}
              </p>
              <p className="text-2xl font-bold text-amber-400">US${totalPending.toFixed(2)}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">
                {monthFilter !== 'all' ? 'Period Paid' : 'Total Paid'}
              </p>
              <p className="text-2xl font-bold text-emerald-400">US${totalPaid.toFixed(2)}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Active Talents</p>
              <p className="text-2xl font-bold text-white">{summaries.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* Talent Detail Stats */}
      {view === 'talent' && activeTalent && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Pending</p>
              <p className="text-xl font-bold text-amber-400">US${activeTalent.pendingEarnings.toFixed(2)}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Paid</p>
              <p className="text-xl font-bold text-emerald-400">US${activeTalent.paidEarnings.toFixed(2)}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Total</p>
              <p className="text-xl font-bold text-white">US${activeTalent.totalEarnings.toFixed(2)}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Commission Rate</p>
              <p className="text-xl font-bold text-cyan-400">
                {activeTalent.earnings[0] ? (activeTalent.earnings[0].commission_rate * 100).toFixed(0) + '%' : '—'}
              </p>
            </div>
          </div>

          {/* Payment Info Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Payment Account</p>
                <PaymentBadge method={activeTalent.paymentMethod} details={activeTalent.paymentDetails} />
                {activeTalent.paymentMethod === 'bank_transfer' && activeTalent.paymentDetails && (
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    {activeTalent.paymentDetails.account_name && (
                      <div><span className="text-gray-500">Name:</span> <span className="text-gray-300">{activeTalent.paymentDetails.account_name}</span></div>
                    )}
                    {activeTalent.paymentDetails.account_number && (
                      <div><span className="text-gray-500">Account:</span> <span className="text-gray-300">{activeTalent.paymentDetails.account_number}</span></div>
                    )}
                    {activeTalent.paymentDetails.bank_code && (
                      <div><span className="text-gray-500">Code:</span> <span className="text-gray-300">{activeTalent.paymentDetails.bank_code}</span></div>
                    )}
                    {activeTalent.paymentDetails.swift_code && (
                      <div><span className="text-gray-500">SWIFT:</span> <span className="text-gray-300">{activeTalent.paymentDetails.swift_code}</span></div>
                    )}
                  </div>
                )}
                {activeTalent.paymentDetails?.notes && (
                  <p className="text-xs text-gray-500 mt-1">{activeTalent.paymentDetails.notes}</p>
                )}
              </div>
              {!activeTalent.paymentMethod && (
                <a href="/admin/talents" className="text-xs text-cyan-400 hover:text-cyan-300 underline">
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
          <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
            <button
              onClick={() => { setView('summary'); setSelected(new Set()); }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === 'summary' ? 'bg-zinc-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5 inline mr-1.5" />
              By Talent
            </button>
            <button
              onClick={() => { setView('detail'); setSelected(new Set()); }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                view === 'detail' ? 'bg-zinc-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Filter className="w-3.5 h-3.5 inline mr-1.5" />
              All Earnings
            </button>
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-white text-sm rounded-lg px-3 py-2"
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
              className="bg-zinc-900 border border-zinc-800 text-white text-sm rounded-lg px-3 py-2"
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
        <div className="text-center py-12 text-gray-400">Loading earnings...</div>
      ) : earnings.length === 0 ? (
        <div className="text-center py-16">
          <DollarSign className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400">No earnings recorded yet</p>
          <p className="text-gray-600 text-sm mt-1">Commissions appear here when orders are completed</p>
        </div>
      ) : view === 'summary' ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-gray-400 text-xs uppercase tracking-wider">
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
                <tr key={s.talentId} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 group">
                  <td className="px-5 py-3">
                    <p className="text-white font-medium">{s.name}</p>
                    <p className="text-gray-500 text-xs">{s.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <PaymentBadge method={s.paymentMethod} details={s.paymentDetails} />
                  </td>
                  <td className="px-5 py-3 text-gray-300">{s.orderCount}</td>
                  <td className="px-5 py-3">
                    {s.pendingEarnings > 0 ? (
                      <span className="text-amber-400 font-medium">US${s.pendingEarnings.toFixed(2)}</span>
                    ) : (
                      <span className="text-gray-600">US$0.00</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-emerald-400">US${s.paidEarnings.toFixed(2)}</td>
                  <td className="px-5 py-3 text-white font-semibold">US${s.totalEarnings.toFixed(2)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openTalentDetail(s)}
                        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-zinc-800 text-gray-300 hover:text-white hover:bg-zinc-700 border border-zinc-700 transition-colors"
                      >
                        View <ChevronRight className="w-3 h-3" />
                      </button>
                      {s.pendingEarnings > 0 && (
                        <button
                          onClick={() => handleMarkPaid(s.earnings.filter(e => e.status === 'pending').map(e => e.id))}
                          disabled={marking}
                          className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/40 disabled:opacity-50 transition-colors"
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
    </div>
  );
}
