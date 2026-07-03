'use client';

/*
  後台請款單頁 —— Wing 看每一筆配音員請款:發票、同意、金額,按「已撥款」結案。
  admin-role only(API 用 requireAdminOnly + cookie)。
*/
import { useEffect, useState, useCallback } from 'react';
import { Receipt, ExternalLink, CheckCircle, RotateCcw, Loader2 } from 'lucide-react';

type Req = {
  id: string; talent_id: string; invoice_number: string; amount: number; currency: string;
  note: string | null; invoice_type: string; invoice_url: string | null; consent_at: string | null;
  status: string; admin_note: string | null; paid_at: string | null; created_at: string;
  talents: { name: string | null; email: string | null } | null;
};

const STATUS_LABEL: Record<string, string> = { pending: '待處理', invoice_uploaded: '已上傳發票', paid: '已撥款', rejected: '已退回' };
const STATUS_CLS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700 border-gray-300',
  invoice_uploaded: 'bg-sky-50 text-sky-700 border-sky-300',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  rejected: 'bg-red-50 text-red-700 border-red-300',
};

export default function PayoutRequestsPage() {
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'invoice_uploaded' | 'paid'>('all');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/payout-requests', { credentials: 'include' });
      const j = await res.json();
      setRows(Array.isArray(j.requests) ? j.requests : []);
    } catch { setRows([]); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function setStatus(id: string, status: string) {
    if (status === 'paid' && !confirm('確認這筆已撥款?')) return;
    if (status === 'rejected' && !confirm('確認退回這筆請款?')) return;
    setBusy(id);
    try {
      const res = await fetch('/api/admin/payout-requests', {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) await load();
    } finally { setBusy(null); }
  }

  const money = (n: number, c: string) => `${c} ${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const fmt = (s: string | null) => { if (!s) return '—'; try { return new Date(s).toLocaleString(); } catch { return s; } };
  const shown = rows.filter((r) => filter === 'all' || r.status === filter);
  const count = (s: string) => rows.filter((r) => r.status === s).length;

  return (
    <div className="p-6 lg:p-10">
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-1"><Receipt className="w-6 h-6 text-violet-600" /> 請款單</h1>
        <p className="text-sm text-gray-500 mb-6">配音員發起的請款。看發票、確認同意,撥款後按「已撥款」結案。款項每月結算、核准後約 30–45 天撥付。</p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {([['待處理', 'pending'], ['已上傳發票', 'invoice_uploaded'], ['已撥款', 'paid']] as const).map(([label, key]) => (
            <div key={key} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">{label}</div>
              <div className="text-2xl font-bold text-gray-900">{count(key)}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-4">
          {([['全部', 'all'], ['待處理', 'pending'], ['已上傳發票', 'invoice_uploaded'], ['已撥款', 'paid']] as const).map(([label, key]) => (
            <button key={key} onClick={() => setFilter(key)} className={`text-xs px-3 py-1.5 rounded-full border ${filter === key ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-300'}`}>{label}</button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin inline" /></div>
        ) : shown.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">目前沒有請款單。</div>
        ) : (
          <div className="space-y-3">
            {shown.map((r) => (
              <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{r.talents?.name || '—'}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${STATUS_CLS[r.status] || 'bg-gray-100 text-gray-600 border-gray-300'}`}>{STATUS_LABEL[r.status] || r.status}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{r.talents?.email} · {r.invoice_number} · {r.invoice_type === 'own' ? '自家發票' : '系統發票'}</div>
                    <div className="text-lg font-bold text-gray-900 mt-1">{money(r.amount, r.currency)}</div>
                    {r.note && <div className="text-xs text-gray-500 mt-0.5">備註:{r.note}</div>}
                    <div className="text-[11px] text-gray-400 mt-1">請款 {fmt(r.created_at)} · 同意 {fmt(r.consent_at)}{r.paid_at ? ` · 撥款 ${fmt(r.paid_at)}` : ''}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {r.invoice_url
                      ? <a href={r.invoice_url} target="_blank" rel="noreferrer" className="text-xs text-violet-700 hover:underline inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" /> 看發票</a>
                      : <span className="text-xs text-gray-400">尚未上傳發票</span>}
                    {r.status !== 'paid' && (
                      <div className="flex gap-2">
                        <button onClick={() => setStatus(r.id, 'paid')} disabled={busy === r.id} className="text-xs px-3 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 inline-flex items-center gap-1">{busy === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} 已撥款</button>
                        {r.status !== 'rejected' && <button onClick={() => setStatus(r.id, 'rejected')} disabled={busy === r.id} className="text-xs px-3 py-1 rounded-md bg-white text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50 inline-flex items-center gap-1"><RotateCcw className="w-3 h-3" /> 退回</button>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
