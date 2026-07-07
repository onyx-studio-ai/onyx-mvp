'use client';

/*
  後台請款單頁 —— Wing 看每一筆配音員請款:發票、同意、金額,按「已撥款」結案。
  admin-role only(API 用 requireAdminOnly + cookie)。
*/
import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Receipt, ExternalLink, CheckCircle, RotateCcw, Loader2, ChevronDown, Download } from 'lucide-react';
import PayoutDetails from '@/components/admin/PayoutDetails';

type Req = {
  id: string; talent_id: string; invoice_number: string; amount: number; currency: string;
  note: string | null; invoice_type: string; invoice_url: string | null; consent_at: string | null;
  status: string; admin_note: string | null; paid_at: string | null; certificate_code: string | null; created_at: string;
  talents: { name: string | null; email: string | null } | null;
};

// 撥款發票 = 金流敏感檔,透過簽名 URL route 開(不管 casting bucket 公開或被鎖成私有都打得開)。
async function openInvoice(invoiceUrl: string) {
  try {
    const res = await fetch(`/api/admin/payout-requests/signed-url?u=${encodeURIComponent(invoiceUrl)}`, { credentials: 'include' });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.url) { window.open(j.url, '_blank', 'noopener,noreferrer'); return; }
    // 拿不到簽名 URL(例如舊路徑),退回直接開原網址,別讓使用者完全點不動。
    window.open(invoiceUrl, '_blank', 'noopener,noreferrer');
  } catch {
    window.open(invoiceUrl, '_blank', 'noopener,noreferrer');
  }
}

const STATUS_LABEL: Record<string, string> = { pending: '待處理', invoice_uploaded: '已上傳發票', paid: '已撥款', rejected: '已退回' };
const STATUS_CLS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700 border-gray-300',
  invoice_uploaded: 'bg-sky-50 text-sky-700 border-sky-300',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  rejected: 'bg-red-50 text-red-700 border-red-300',
};

export default function PayoutRequestsPage() {
  const t = useTranslations('admin.payoutRequests');
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'invoice_uploaded' | 'paid'>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  // 會計對帳匯出:預設今年;月份空 = 整年。
  const thisYear = String(new Date().getFullYear());
  const [expYear, setExpYear] = useState(thisYear);
  const [expMonth, setExpMonth] = useState(''); // '' = 整年,'01'..'12' = 該月
  const [exporting, setExporting] = useState(false);

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
    if (status === 'paid' && !confirm(t('confirmPaid'))) return;
    if (status === 'rejected' && !confirm(t('confirmReject'))) return;
    setBusy(id);
    try {
      const res = await fetch('/api/admin/payout-requests', {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        const j = await res.json().catch(() => ({}));
        // 撥款已完成,但通知信寄送有狀況 → 提醒老闆(撥款本身照樣成功)。
        if (j.warning) alert(t('payoutDoneNotifyIssue', { warning: j.warning }));
        await load();
      }
    } finally { setBusy(null); }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const period = expMonth ? `${expYear}-${expMonth}` : expYear;
      const res = await fetch(`/api/admin/payout-requests/export?period=${encodeURIComponent(period)}`, { credentials: 'include' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || t('exportFailed'));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${t('exportFilePrefix')}_${period}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { alert(t('exportFailedRetry')); } finally { setExporting(false); }
  }

  const money = (n: number, c: string) => `${c} ${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const fmt = (s: string | null) => { if (!s) return '—'; try { return new Date(s).toLocaleString(); } catch { return s; } };
  const shown = rows.filter((r) => filter === 'all' || r.status === filter);
  const count = (s: string) => rows.filter((r) => r.status === s).length;

  return (
    <div className="p-6 lg:p-10">
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-1"><Receipt className="w-6 h-6 text-violet-600" /> {t('pageTitle')}</h1>
        <p className="text-sm text-gray-500 mb-6">{t('pageSubtitle')}</p>

        {/* 會計對帳匯出:選整年或某月,匯出該期間已撥款的對帳 CSV(不含收款帳號個資)。 */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 mb-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-700"><Download className="w-4 h-4 text-gray-500" /> {t('reconExport')}</div>
          <select value={expYear} onChange={(e) => setExpYear(e.target.value)} className="text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white">
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => <option key={y} value={String(y)}>{t('yearSuffix', { year: y })}</option>)}
          </select>
          <select value={expMonth} onChange={(e) => setExpMonth(e.target.value)} className="text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white">
            <option value="">{t('wholeYear')}</option>
            {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((m) => <option key={m} value={m}>{t('monthSuffix', { month: m })}</option>)}
          </select>
          <button onClick={exportCsv} disabled={exporting} className="text-sm px-3 py-1.5 rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 inline-flex items-center gap-1.5">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} {t('exportCsv')}
          </button>
          <span className="text-xs text-gray-400">{t('exportNote')}</span>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {([['statPending', 'pending'], ['statInvoiceUploaded', 'invoice_uploaded'], ['statPaid', 'paid']] as const).map(([labelKey, key]) => (
            <div key={key} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">{t(labelKey)}</div>
              <div className="text-2xl font-bold text-gray-900">{count(key)}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-4">
          {([['filterAll', 'all'], ['statPending', 'pending'], ['statInvoiceUploaded', 'invoice_uploaded'], ['statPaid', 'paid']] as const).map(([labelKey, key]) => (
            <button key={key} onClick={() => setFilter(key)} className={`text-xs px-3 py-1.5 rounded-full border ${filter === key ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-300'}`}>{t(labelKey)}</button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin inline" /></div>
        ) : shown.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">{t('noRequests')}</div>
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
                    <div className="text-xs text-gray-500 mt-0.5">{r.talents?.email} · {r.invoice_number} · {r.invoice_type === 'own' ? t('invoiceTypeOwn') : t('invoiceTypeSystem')}</div>
                    <div className="text-lg font-bold text-gray-900 mt-1">{money(r.amount, r.currency)}</div>
                    {r.note && <div className="text-xs text-gray-500 mt-0.5">{t('noteLabel')}{r.note}</div>}
                    <div className="text-[11px] text-gray-400 mt-1">{t('requestedAt', { time: fmt(r.created_at) })} · {t('consentedAt', { time: fmt(r.consent_at) })}{r.paid_at ? t('paidAt', { time: fmt(r.paid_at) }) : ''}</div>
                    {r.certificate_code && (
                      <div className="text-[11px] text-emerald-700 mt-1">{t('certificateCodeLabel')}<span className="font-mono select-all">{r.certificate_code}</span></div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {r.invoice_url
                      ? <button onClick={() => openInvoice(r.invoice_url!)} className="text-xs text-violet-700 hover:underline inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" /> {t('viewInvoice')}</button>
                      : <span className="text-xs text-gray-400">{t('invoiceNotUploaded')}</span>}
                    <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="text-xs px-3 py-1 rounded-md bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 inline-flex items-center gap-1">
                      {t('payoutDetails')} <ChevronDown className={`w-3 h-3 transition-transform ${expanded === r.id ? 'rotate-180' : ''}`} />
                    </button>
                    {r.status !== 'paid' && (
                      <div className="flex gap-2">
                        <button onClick={() => setStatus(r.id, 'paid')} disabled={busy === r.id} className="text-xs px-3 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 inline-flex items-center gap-1">{busy === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} {t('markPaid')}</button>
                        {r.status !== 'rejected' && <button onClick={() => setStatus(r.id, 'rejected')} disabled={busy === r.id} className="text-xs px-3 py-1 rounded-md bg-white text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50 inline-flex items-center gap-1"><RotateCcw className="w-3 h-3" /> {t('reject')}</button>}
                      </div>
                    )}
                  </div>
                </div>
                {expanded === r.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">{t('payoutDetailsWithholding', { currency: r.currency })}</p>
                    <PayoutDetails talentId={r.talent_id} gross={Number(r.amount) || 0} currency={r.currency} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
