'use client';

/*
  財務總覽 — the receivables (應收) side that 人才分潤 (payouts, 應付) and 口袋
  (pockets, 現金) didn't cover, plus a single money snapshot. Pure aggregation
  over existing endpoints (no new table):
    /api/admin/stats     → voice + music orders (price, payment_status) = 應收
    /api/admin/earnings  → talent_earnings (commission_amount, status) = 應付
  Light admin theme; uses the shared AdminHeader + AdminStats. Admin-cookie auth
  (the layout gates login). Amounts follow the existing dashboard convention
  (summed as one currency — orders carry no currency column yet).
*/

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Search, RefreshCw, Wallet, DollarSign } from 'lucide-react';
import { AdminHeader, AdminStats } from '@/components/admin/list-ui';

type Order = {
  id: string; order_number?: string | null; project_name?: string | null; email: string;
  price: number | null; status: string; payment_status: string | null; created_at: string; paid_at?: string | null;
  voice_selection?: string | null; vibe?: string | null;
};
type Earning = { status: string; commission_amount: number | null };

const usd = (n: number) => 'US$' + Math.round(n || 0).toLocaleString('en-US');
const ym = (iso?: string | null) => (iso || '').slice(0, 7); // YYYY-MM

export default function AdminFinance() {
  const [phase, setPhase] = useState<'loading' | 'ready'>('loading');
  const [orders, setOrders] = useState<(Order & { _type: 'voice' | 'music' })[]>([]);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [s, e] = await Promise.all([
        fetch('/api/admin/stats', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/admin/earnings', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (s) {
        const v = (s.voiceOrders || []).map((o: Order) => ({ ...o, _type: 'voice' as const }));
        const m = (s.musicOrders || []).map((o: Order) => ({ ...o, _type: 'music' as const }));
        setOrders([...v, ...m]);
      }
      if (e) setEarnings(e.earnings || []);
    } catch { toast.error('載入失敗,請稍後再試'); } finally { setRefreshing(false); setPhase('ready'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Real (non-draft / non-failed) orders only.
  const live = useMemo(() => orders.filter((o) => o.status !== 'draft' && o.status !== 'failed'), [orders]);
  const isPaid = (o: Order) => o.payment_status === 'paid';

  const months = useMemo(() => {
    const set = new Set<string>();
    live.forEach((o) => { const k = ym(o.paid_at || o.created_at); if (k) set.add(k); });
    return Array.from(set).sort().reverse();
  }, [live]);

  const inMonth = (o: Order) => month === 'all' || ym(o.paid_at || o.created_at) === month;

  // Money snapshot (respects the month filter for orders; payables are a live ledger).
  const collected = live.filter((o) => isPaid(o) && inMonth(o)).reduce((s, o) => s + (o.price || 0), 0);
  const receivable = live.filter((o) => !isPaid(o) && inMonth(o)).reduce((s, o) => s + (o.price || 0), 0);
  const payable = earnings.filter((e) => e.status === 'pending').reduce((s, e) => s + (e.commission_amount || 0), 0);
  const paidOut = earnings.filter((e) => e.status === 'paid').reduce((s, e) => s + (e.commission_amount || 0), 0);

  // The receivables list = unpaid orders (who still owes us), newest first.
  const q = search.trim().toLowerCase();
  const receivables = live
    .filter((o) => !isPaid(o) && inMonth(o))
    .filter((o) => !q || [o.order_number, o.email, o.project_name, o.voice_selection, o.vibe].some((x) => (x || '').toString().toLowerCase().includes(q)))
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  return (
    <div className="p-6 lg:p-8 text-gray-900">
      <AdminHeader
        title="財務總覽"
        subtitle="客戶應收 + 配音員應付的整體金流快照。應付明細在「人才分潤」,現金分倉在「口袋」。"
        action={(
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
        )}
      />

      <AdminStats items={[
        { label: month === 'all' ? '已收(全部)' : `已收(${month})`, value: usd(collected), color: 'text-green-700' },
        { label: '待收(未付款)', value: usd(receivable), color: 'text-amber-700' },
        { label: '配音員待付', value: usd(payable), color: 'text-red-700' },
        { label: '配音員已付', value: usd(paidOut), color: 'text-gray-500' },
        { label: '平台結餘(已收−已付)', value: usd(collected - paidOut), color: 'text-blue-700' },
      ]} />

      {/* Receivables toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜尋訂單編號、客戶 Email、專案…"
            className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none" />
        </div>
        <select value={month} onChange={(e) => setMonth(e.target.value)} className="bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none">
          <option value="all">全部月份</option>
          {months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <h2 className="text-sm font-semibold text-gray-700 mb-3">待收款項{receivables.length > 0 ? ` · ${receivables.length} 筆 · ${usd(receivable)}` : ''}</h2>

      {phase === 'loading' ? (
        <div className="text-center py-16 text-gray-500 bg-white border border-gray-200 rounded-xl">載入中…</div>
      ) : receivables.length === 0 ? (
        <div className="text-center py-16 text-gray-500 bg-white border border-gray-200 rounded-xl">{q || month !== 'all' ? '沒有符合的待收款項。' : '目前沒有待收款項,全部已收 ✓'}</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {receivables.map((o) => (
            <div key={`${o._type}-${o.id}`} className="flex items-center gap-3 px-5 py-3.5">
              <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${o._type === 'voice' ? 'bg-cyan-50 text-cyan-700 border border-cyan-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>{o._type === 'voice' ? '配音' : '音樂'}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{o.project_name || o.voice_selection || o.vibe || '—'}</p>
                <p className="text-xs text-gray-500 truncate">{o.order_number ? `#${o.order_number} · ` : ''}{o.email}</p>
              </div>
              <span className="text-xs text-gray-400 shrink-0 hidden sm:block">{(o.created_at || '').slice(0, 10)}</span>
              <span className="text-sm font-semibold text-amber-700 shrink-0 w-24 text-right">{usd(o.price || 0)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Cross-links to the other money views */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
        <a href="/admin/payouts" className="flex items-center gap-3 bg-white border border-gray-200 hover:border-gray-300 rounded-xl px-5 py-4 transition-colors">
          <DollarSign className="w-5 h-5 text-emerald-700 shrink-0" />
          <div className="min-w-0"><p className="text-sm font-semibold text-gray-900">配音員應付明細</p><p className="text-xs text-gray-500">每位配音員的待付/已付、月結批次 → 人才分潤</p></div>
        </a>
        <a href="/admin/pockets" className="flex items-center gap-3 bg-white border border-gray-200 hover:border-gray-300 rounded-xl px-5 py-4 transition-colors">
          <Wallet className="w-5 h-5 text-blue-700 shrink-0" />
          <div className="min-w-0"><p className="text-sm font-semibold text-gray-900">現金分倉</p><p className="text-xs text-gray-500">Profit First 收入分配與支出 → 口袋</p></div>
        </a>
      </div>
    </div>
  );
}
