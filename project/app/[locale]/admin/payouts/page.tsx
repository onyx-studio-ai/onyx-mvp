'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DollarSign, Download, CheckCircle, Clock, Filter, RefreshCw, User, ChevronRight, CreditCard, ArrowLeft, Calendar, Wallet, Plus, X, Folder, ChevronDown } from 'lucide-react';
import { computeDeductions, MIN_PAYOUT_USD_INTL } from '@/lib/payout-policy';

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

// Decrypted payout details, fetched ON DEMAND (click to reveal) from the restricted
// table so the national ID / bank account is only materialised when Wing actually
// needs to pay. Admin-role only; never bulk-loaded.
function PayoutDetails({ talentId, gross }: { talentId: string; gross: number }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'none' | 'error'>('idle');
  const [d, setD] = useState<{ region: string; payout_method: string; details: Record<string, string>; updated_at?: string } | null>(null);
  const [err, setErr] = useState('');

  async function load() {
    setStatus('loading'); setErr('');
    try {
      const r = await fetch(`/api/admin/payout-details?talent_id=${encodeURIComponent(talentId)}`);
      const j = await r.json();
      if (!r.ok) { setErr(j.error === 'payout_enc_unconfigured' ? '加密金鑰未設定 (Vercel env: PAYOUT_ENC_KEY)' : j.error === 'decrypt_failed' ? '解密失敗(金鑰不符?)' : (j.error || '讀取失敗')); setStatus('error'); return; }
      if (!j.found) { setStatus('none'); return; }
      setD({ region: j.region, payout_method: j.payout_method, details: j.details || {}, updated_at: j.updated_at });
      setStatus('done');
    } catch { setErr('讀取失敗'); setStatus('error'); }
  }

  const Row = ({ k, v }: { k: string; v?: string }) => v ? (
    <div className="flex gap-2"><span className="text-gray-500 w-24 shrink-0">{k}</span><span className="text-gray-800 font-mono break-all select-all">{v}</span></div>
  ) : null;

  if (status === 'idle') {
    return <button onClick={load} className="text-xs px-3 py-1 rounded-md bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors">🔒 查看收款資料</button>;
  }
  if (status === 'loading') return <span className="text-xs text-gray-500">讀取中…</span>;
  if (status === 'error') return <span className="text-xs text-red-600">{err}</span>;
  if (status === 'none') return <span className="text-xs text-gray-500">配音員尚未填寫收款資料。</span>;

  const x = d!.details;
  const method = d!.payout_method;
  const taxLoc = d!.region; // 'TW' | 'overseas'
  const dd = gross > 0 ? computeDeductions({ gross, method: method === 'bank' ? 'bank' : 'paypal', bankCountry: x.bank_country, taxLocation: taxLoc === 'TW' ? 'TW' : 'overseas', twResident: !!x.tw_resident }) : null;
  const isIntl = !(method === 'bank' && (x.bank_country || '').toUpperCase() === 'TW');
  const belowMin = isIntl && gross > 0 && gross < MIN_PAYOUT_USD_INTL;
  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3 text-xs space-y-1 max-w-md">
      <div className="font-medium text-violet-800 mb-1">{method === 'bank' ? '🏦 銀行匯款' : '💸 PayPal'}</div>
      {method === 'bank' ? (
        <>
          <Row k="帳戶姓名" v={x.account_holder} />
          <Row k="銀行" v={[x.bank_name, x.bank_country ? `(${x.bank_country})` : '', x.bank_branch].filter(Boolean).join(' ')} />
          <Row k="帳號" v={x.account_number} />
          <Row k="IBAN" v={x.iban} />
          <Row k="SWIFT/BIC" v={x.swift} />
        </>
      ) : (
        <>
          <Row k="姓名/公司" v={x.account_holder} />
          <Row k="PayPal" v={x.paypal_email} />
          <p className="text-[11px] text-amber-700 pt-1">付款前請向配音員索取 invoice。</p>
        </>
      )}
      <div className="border-t border-violet-200 mt-1.5 pt-1.5">
        <Row k="稅務" v={taxLoc === 'TW' ? (x.tw_resident ? '台灣居住者(≥2萬才扣10%+2.11%)' : '台灣非居住者(扣20%)') : '海外(不扣台灣稅)'} />
        {taxLoc === 'TW' && <Row k="身分/居留證" v={x.national_id} />}
        {taxLoc === 'TW' && <Row k="地址" v={x.tax_address} />}
      </div>
      {dd && (
        <div className="border-t border-violet-200 mt-1.5 pt-1.5">
          <div className="text-violet-800 font-medium mb-0.5">扣繳試算(供參)</div>
          <Row k="請款額" v={String(gross)} />
          {dd.tax > 0 && <Row k={taxLoc === 'TW' && x.tw_resident ? '扣繳稅 10%' : '扣繳稅 20%'} v={`-${dd.tax}`} />}
          {dd.nhi > 0 && <Row k="二代健保 2.11%" v={`-${dd.nhi}`} />}
          <Row k="手續費" v={dd.feeNote} />
          <Row k="實收(估)" v={String(dd.net)} />
          <p className="text-[10px] text-gray-500 pt-1">試算供參,實際稅額以會計為準;手續費單位依收款方式(台灣 NT$ / 國際 US$)。</p>
          {belowMin && <p className="text-[10px] text-amber-700 pt-0.5">⚠ 低於國際最低請款 US${MIN_PAYOUT_USD_INTL},建議累積後再撥。</p>}
        </div>
      )}
    </div>
  );
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

  // Buyouts don't have a client-side invoicing/payment flow — Wing
  // pays the talent directly with no client deal in the middle. Drop
  // those two boxes from the checklist for buyout rows.
  const BUYOUT_CHECKLIST_FIELDS = CHECKLIST_FIELDS.filter(
    f => f !== 'invoice_sent' && f !== 'payment_received',
  ) as readonly ChecklistField[];

  const effectiveChecklist = (e: Earning): readonly ChecklistField[] =>
    // buyout + managed (directly-assigned casting role) skip the client
    // invoice/payment boxes — Onyx pays the talent a fixed fee, client billed apart.
    e.tier === 'buyout' || e.tier === 'managed' ? BUYOUT_CHECKLIST_FIELDS : CHECKLIST_FIELDS;

  const checklistCount = (e: Earning) =>
    effectiveChecklist(e).reduce((acc, f) => acc + (e[f] ? 1 : 0), 0);

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
            const isBuyout = e.tier === 'buyout';
            const isManaged = e.tier === 'managed';   // directly-assigned casting role
            const isSimplified = isBuyout || isManaged; // simplified filing checklist
            const checklistTotal = effectiveChecklist(e).length;
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
                    {isBuyout ? (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                        🔒 Buyout
                      </span>
                    ) : isManaged ? (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">
                        🎯 指派製作
                      </span>
                    ) : isManual ? (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        Manual
                      </span>
                    ) : null}
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
                        filed === checklistTotal
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : filed > 0
                          ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <span className="font-mono">{filed}/{checklistTotal}</span>
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
                        {e.talent_id && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">收款資料</p>
                            <PayoutDetails talentId={e.talent_id} gross={Number(e.commission_amount) || 0} />
                          </div>
                        )}
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
                          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                            歸檔進度{isBuyout && <span className="ml-1 text-purple-700">(買斷流程簡化版)</span>}{isManaged && <span className="ml-1 text-violet-700">(指派製作簡化版)</span>}
                          </p>
                          <div className={`grid grid-cols-2 ${isSimplified ? 'md:grid-cols-3' : 'md:grid-cols-5'} gap-2`}>
                            {effectiveChecklist(e).map(field => {
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
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          {view === 'talent' && activeTalent ? (
            <div>
              <button onClick={backToSummary} className="inline-flex items-center gap-1.5 text-gray-600 hover:text-gray-900 text-sm mb-2 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Summary
              </button>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <User className="w-7 h-7 text-emerald-700" />
                {activeTalent.name}
              </h1>
              <p className="text-gray-600 text-sm mt-1">{activeTalent.email} · {activeTalent.orderCount} orders</p>
            </div>
          ) : (
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
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
                    {activeTalent.paymentDetails.bank_name && (
                      <div><span className="text-gray-500">Bank:</span> <span className="text-gray-700">{activeTalent.paymentDetails.bank_name}</span></div>
                    )}
                    {activeTalent.paymentDetails.account_number && (
                      <div><span className="text-gray-500">Account / IBAN:</span> <span className="text-gray-700">{activeTalent.paymentDetails.account_number}</span></div>
                    )}
                    {activeTalent.paymentDetails.swift_code && (
                      <div><span className="text-gray-500">SWIFT / BIC:</span> <span className="text-gray-700">{activeTalent.paymentDetails.swift_code}</span></div>
                    )}
                    {activeTalent.paymentDetails.bank_code && (
                      <div><span className="text-gray-500">Routing / Sort:</span> <span className="text-gray-700">{activeTalent.paymentDetails.bank_code}</span></div>
                    )}
                    {activeTalent.paymentDetails.bank_country && (
                      <div><span className="text-gray-500">Country:</span> <span className="text-gray-700">{activeTalent.paymentDetails.bank_country}</span></div>
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
  const [subtype, setSubtype] = useState<'client_deal' | 'buyout'>('client_deal');
  const [talentId, setTalentId] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  // Tracks whether the user has manually typed in the Order Number
  // field. When false, switching subtype (or first mount) re-fetches
  // the next auto-generated number from the API. When true, we leave
  // their value alone — they explicitly chose a custom slug.
  const [orderNumberManuallyEdited, setOrderNumberManuallyEdited] = useState(false);
  const [realTotal, setRealTotal] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBuyout = subtype === 'buyout';

  // Auto-fill the next manual order number on mount and whenever the
  // subtype switches (case_deal ↔ buyout). Skip if the user has already
  // hand-edited the field (orderNumberManuallyEdited). Single fetch per
  // subtype change; no debounce needed.
  useEffect(() => {
    if (orderNumberManuallyEdited) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/earnings/next-manual-number?subtype=${subtype}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.nextNumber) {
          setOrderNumber(data.nextNumber);
        }
      } catch {
        // best-effort — leave field blank, user can type
      }
    })();
    return () => { cancelled = true; };
  }, [subtype, orderNumberManuallyEdited]);

  const talent = talentOptions.find(t => t.id === talentId);
  const suggestedFolderPath = useMemo(() => {
    if (!orderNumber) return '';
    const year = new Date().getFullYear();
    const talentSlug = talent?.name?.replace(/\s+/g, '_') || 'Talent';
    const prefix = isBuyout ? 'Buyout' : 'Case';
    return `${year}/${isBuyout ? 'Buyouts' : 'Cases'}/${prefix}_${orderNumber}_${talentSlug}`;
  }, [orderNumber, talent, isBuyout]);

  const effectiveFolderPath = folderPath || suggestedFolderPath;

  // Auto-compute Wing's net + margin from Real Total - Talent Payout.
  // 2026-06-07: replaced the 4-field cost breakdown (marketing/platform_fee/
  // operations/other) — Wing won't manually itemise per case. Real cost
  // tracking moved to Phase 5 Profit First pockets system, which auto-splits
  // every received payment across 6 pockets. This modal now just captures
  // the per-case headline numbers; pocket allocation happens when Wing ticks
  // the "已收款" checkbox.
  const realTotalNum = Number(realTotal) || 0;
  const payoutNum = Number(payoutAmount) || 0;
  const wingNet = realTotalNum - payoutNum;
  const marginPct = realTotalNum > 0 ? (wingNet / realTotalNum) * 100 : 0;
  const marginColor =
    marginPct >= 50
      ? { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', label: '✅ 健康' }
      : marginPct >= 30
      ? { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', label: '🟡 偏低,可接受' }
      : { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', label: '⚠️ 太低,虧本邊緣' };

  const handleSubmit = async () => {
    setError(null);
    if (!talentId) return setError('請選配音員');
    if (!orderNumber.trim()) return setError('請輸入 Order Number');
    if (!payoutAmount || Number(payoutAmount) <= 0) {
      return setError(isBuyout ? '買斷金額要大於 0' : 'Talent payout 要大於 0');
    }
    if (!isBuyout && (!realTotal || realTotalNum <= 0)) {
      return setError('Real total 要大於 0');
    }

    setSaving(true);
    try {
      // cost_breakdown JSONB now only holds Notes (free-text context).
      // Per-case itemisation removed; real cost allocation lives in
      // Phase 5 pockets system.
      const costBreakdown: Record<string, number | string> = {};
      if (notes.trim()) costBreakdown.notes = notes.trim();

      const res = await fetch('/api/admin/earnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderType: 'manual',
          subtype,
          talentId,
          orderNumber: orderNumber.trim(),
          ...(isBuyout ? {} : { realTotal: Number(realTotal) }),
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
              {isBuyout
                ? '一次付清買斷配音員的聲音。沒客戶 invoice,後續平台收入 Wing 拿 100%。'
                : '線下/離平台案子。Real total 跟 talent payout 可以不一樣 — 中間差額放成本拆分,配音員看不到。'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Subtype switch */}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
            <button
              type="button"
              onClick={() => setSubtype('client_deal')}
              className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                !isBuyout ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              💼 案子分潤
              <span className="block text-[10px] font-normal text-gray-500 mt-0.5">
                客戶離平台付款,配音員拿一塊
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSubtype('buyout')}
              className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isBuyout ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🔒 買斷配音員
              <span className="block text-[10px] font-normal text-gray-500 mt-0.5">
                Wing 一次付清,聲音歸我
              </span>
            </button>
          </div>

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
              <label className="block text-xs text-gray-600 mb-1">
                Order Number *
                {!orderNumberManuallyEdited && orderNumber && (
                  <span className="ml-1.5 text-[10px] text-gray-400 font-normal">(auto)</span>
                )}
              </label>
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => {
                  setOrderNumber(e.target.value);
                  setOrderNumberManuallyEdited(true);
                }}
                placeholder={isBuyout ? 'BUYOUT-2026-001' : 'MANUAL-2026-001'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                {orderNumberManuallyEdited
                  ? '自訂編號(改動後不再自動更新)'
                  : '系統自動填下一個流水號,你可以直接改成自訂(例 SIERRA-Q3)'}
              </p>
            </div>
          </div>

          {isBuyout ? (
            <div>
              <label className="block text-xs text-gray-600 mb-1">買斷金額 (US$) *</label>
              <input
                type="number"
                step="0.01"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="5000"
                className="w-full border border-purple-300 rounded-lg px-3 py-2 text-sm font-mono bg-purple-50"
              />
              <p className="text-[10px] text-purple-700 mt-1">
                Wing 一次付給配音員的買斷價。付完聲音歸 Onyx,後續平台收入 Wing 拿 100%。
              </p>
            </div>
          ) : (
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
          )}

          {!isBuyout && realTotalNum > 0 && payoutNum > 0 && (
            <div className={`rounded-lg border ${marginColor.border} ${marginColor.bg} p-3 space-y-1`}>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-gray-600">Wing&apos;s Net:</span>
                <span className={`text-lg font-bold font-mono ${marginColor.text}`}>
                  US${wingNet.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-gray-600">Margin %:</span>
                <span className={`text-sm font-semibold ${marginColor.text}`}>
                  {marginPct.toFixed(1)}%  {marginColor.label}
                </span>
              </div>
              <p className="text-[10px] text-gray-500 pt-1">
                收款後自動拆 6 個 Profit First 口袋 — 看 <code>/admin/pockets</code>
              </p>
            </div>
          )}

          <div>
            <label className="block text-[10px] text-gray-500 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isBuyout ? 'e.g. Wing 自己找的 talent,Onyx 錄音室錄' : 'e.g. 跟 X 公司簽 3 年獨家,中間經過 Y agency'}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
            />
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
