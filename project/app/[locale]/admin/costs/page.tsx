'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  RefreshCw, Plus, Pencil, Trash2, ExternalLink, Receipt, Wrench,
  AlertTriangle, X, Upload, FileText, Package, Check,
  ChevronRight, ChevronDown,
} from 'lucide-react';
import { AdminHeader, AdminStats } from '@/components/admin/list-ui';
import { supabase } from '@/lib/supabase';

interface Cost {
  id: string;
  name: string;
  category: string | null;
  plan: string | null;
  monthly_cost: number | null;
  currency: string;
  billing_cycle: string;
  renewal_date: string | null;
  url: string | null;
  status: string;
  note: string | null;
  sort_order: number;
}

interface Invoice {
  id: string;
  cost_id: string;
  period: string;
  invoice_url: string;
  file_name: string | null;
  uploaded_at: string;
  platform_costs?: { name: string } | null;
}

// 當前月份 YYYY-MM(本地時區)
function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// 上傳「歸屬月份」下拉選項:當前月往回推 24 個月(新到舊),讓補傳的發票能歸到對的月。
function recentPeriods(count = 24): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < count; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

// 把某工具的發票依「年 → 月」分組並排序(新月在上、新年在上),供折疊清單渲染。
function groupInvoicesByYearMonth(list: Invoice[]): { year: string; months: { period: string; items: Invoice[] }[] }[] {
  const byPeriod = new Map<string, Invoice[]>();
  for (const inv of list) {
    const p = PERIOD_RE.test(inv.period) ? inv.period : '未分類'; // period 異常時歸「未分類」,不丟資料
    (byPeriod.get(p) || byPeriod.set(p, []).get(p)!).push(inv);
  }
  const byYear = new Map<string, { period: string; items: Invoice[] }[]>();
  for (const [period, items] of byPeriod) {
    const year = period === '未分類' ? '未分類' : period.slice(0, 4);
    (byYear.get(year) || byYear.set(year, []).get(year)!).push({ period, items });
  }
  return [...byYear.entries()]
    .map(([year, months]) => ({
      year,
      months: months.sort((a, b) => (a.period < b.period ? 1 : -1)), // 新月在上
    }))
    .sort((a, b) => (a.year < b.year ? 1 : -1)); // 新年在上,「未分類」字串排序自然落到最後
}

const PERIOD_RE = /^\d{4}-\d{2}$/;
const THIS_YEAR = String(new Date().getFullYear());

const BILLING_LABEL: Record<string, string> = {
  monthly: '每月', yearly: '年費', usage: '按量', free: '免費',
};
const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  active: { label: '使用中', cls: 'bg-green-50 text-green-700 border-green-200' },
  review: { label: '待評估', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  inactive: { label: '已停用', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
};
const CATEGORIES = ['資料庫·儲存', '部署', 'Email', 'GPU 運算', '網域', '金流', '分析', '通知', '其他'];

const INPUT = 'w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-300 focus:outline-none transition-colors';

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.active;
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>{cfg.label}</span>;
}

/** 新增 / 編輯表單(modal)。cost=null 為新增。 */
function CostForm({ cost, onClose, onSaved }: { cost: Cost | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('admin.costs');
  const [f, setF] = useState({
    name: cost?.name || '',
    category: cost?.category || '',
    plan: cost?.plan || '',
    monthly_cost: cost?.monthly_cost == null ? '' : String(cost.monthly_cost),
    currency: cost?.currency || 'USD',
    billing_cycle: cost?.billing_cycle || 'monthly',
    renewal_date: cost?.renewal_date || '',
    url: cost?.url || '',
    status: cost?.status || 'active',
    note: cost?.note || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.name.trim()) { toast.error(t('toolNameRequired')); return; }
    setSaving(true);
    const payload = {
      ...f,
      monthly_cost: f.monthly_cost.trim() === '' ? null : Number(f.monthly_cost),
      ...(cost ? { id: cost.id } : {}),
    };
    const res = await fetch('/api/admin/costs', {
      method: cost ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { toast.error(data.error || t('saveFailed')); return; }
    toast.success(cost ? t('updated') : t('added'));
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/30 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-200 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">{cost ? t('editCost') : t('addCost')}</h3>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('toolNameLabel')}</label>
            <input className={INPUT} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder={t('toolNamePlaceholder')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('categoryLabel')}</label>
              <input className={INPUT} value={f.category} onChange={(e) => set('category', e.target.value)} list="cost-categories" placeholder={t('categoryPlaceholder')} />
              <datalist id="cost-categories">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('currentPlanLabel')}</label>
              <input className={INPUT} value={f.plan} onChange={(e) => set('plan', e.target.value)} placeholder={t('currentPlanPlaceholder')} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('monthlyFeeLabel')}</label>
              <input className={INPUT} type="number" min="0" step="0.01" value={f.monthly_cost} onChange={(e) => set('monthly_cost', e.target.value)} placeholder={t('monthlyFeePlaceholder')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('currencyLabel')}</label>
              <select className={INPUT} value={f.currency} onChange={(e) => set('currency', e.target.value)}>
                <option value="USD">USD</option>
                <option value="TWD">TWD</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('billingCycleLabel')}</label>
              <select className={INPUT} value={f.billing_cycle} onChange={(e) => set('billing_cycle', e.target.value)}>
                <option value="monthly">{t('billingMonthly')}</option>
                <option value="yearly">{t('billingYearly')}</option>
                <option value="usage">{t('billingUsage')}</option>
                <option value="free">{t('billingFree')}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('renewalDateLabel')}</label>
              <input className={INPUT} value={f.renewal_date} onChange={(e) => set('renewal_date', e.target.value)} placeholder={t('renewalDatePlaceholder')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('statusLabel')}</label>
              <select className={INPUT} value={f.status} onChange={(e) => set('status', e.target.value)}>
                <option value="active">{t('statusActive')}</option>
                <option value="review">{t('statusReviewUpgrade')}</option>
                <option value="inactive">{t('statusInactive')}</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('adminLinkLabel')}</label>
            <input className={INPUT} value={f.url} onChange={(e) => set('url', e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('noteLabel')}</label>
            <textarea className={`${INPUT} resize-none`} rows={2} value={f.note} onChange={(e) => set('note', e.target.value)} placeholder={t('notePlaceholder')} />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">{t('cancel')}</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50">{saving ? t('saving') : (cost ? t('saveChanges') : t('add'))}</button>
        </div>
      </div>
    </div>
  );
}

// 透過簽名 URL route 開發票(不管 casting bucket 是公開還是被鎖成私有都打得開)。
async function openInvoice(invoice: Invoice) {
  try {
    const res = await fetch(`/api/admin/costs/invoices/signed-url?u=${encodeURIComponent(invoice.invoice_url)}`);
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.url) { window.open(j.url, '_blank', 'noopener,noreferrer'); return; }
    // 拿不到簽名 URL(例如舊路徑),退回直接開原網址,別讓使用者完全點不動。
    window.open(invoice.invoice_url, '_blank', 'noopener,noreferrer');
  } catch {
    window.open(invoice.invoice_url, '_blank', 'noopener,noreferrer');
  }
}

function CostCard({ cost, invoices, currentMonth, onEdit, onDelete, onInvoiceChanged }: {
  cost: Cost; invoices: Invoice[]; currentMonth: string;
  onEdit: () => void; onDelete: () => void; onInvoiceChanged: () => void;
}) {
  const t = useTranslations('admin.costs');
  const [uploading, setUploading] = useState(false);
  // 上傳歸屬月份:預設當前月;補傳舊發票時可改成對應月份,不會全擠當前月。
  const [uploadPeriod, setUploadPeriod] = useState(currentMonth);
  // 折疊狀態:預設只展開今年;各月預設收合,點開才看該月發票。
  const [openYears, setOpenYears] = useState<Record<string, boolean>>({ [THIS_YEAR]: true });
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});

  // badge / 統計只看「當前月」子集,語意維持「本月發票是否已上傳」。
  const currentMonthInvoices = invoices.filter((i) => i.period === currentMonth);
  const uploaded = currentMonthInvoices.length > 0;
  const grouped = groupInvoicesByYearMonth(invoices);

  // 上傳單一發票檔(不碰 UI/toast,失敗就 throw);批量由 uploadInvoices 統一收斂。
  const uploadOne = async (file: File): Promise<void> => {
    // 步驟 1:拿 signed upload URL(帶所選歸屬月份 uploadPeriod)
    const prep = await fetch('/api/admin/costs/invoices', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cost_id: cost.id, period: uploadPeriod, fileName: file.name }),
    });
    const pj = await prep.json().catch(() => ({}));
    if (!prep.ok) throw new Error(pj.error || t('prepUploadFailed'));
    // 步驟 2:上傳到 casting bucket(同專案發票上傳模式)
    const { error } = await supabase.storage.from('casting').uploadToSignedUrl(pj.path, pj.token, file);
    if (error) throw new Error(t('fileUploadFailed', { msg: error.message }));
    // 步驟 3:記一筆發票。存 storage path(pj.path)而非公開網址 —— 之後一律用
    // 簽名 URL route 來開,bucket 是公開或私有都不影響。
    const rec = await fetch('/api/admin/costs/invoices', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record: true, cost_id: cost.id, period: uploadPeriod, invoice_url: pj.path, file_name: file.name }),
    });
    const rj = await rec.json().catch(() => ({}));
    if (!rec.ok) throw new Error(rj.error || t('recordInvoiceFailed'));
  };

  // 批量上傳:序列跑(避免併發簽名 URL 撞在一起),最後一次總結 + 刷新;單檔多檔都走這。
  const uploadInvoices = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    let ok = 0; const fails: string[] = [];
    for (const file of files) {
      try { await uploadOne(file); ok++; }
      catch (e) { fails.push(`${file.name}:${e instanceof Error ? e.message : t('failed')}`); }
    }
    setUploading(false);
    if (ok > 0) { toast.success(t('uploadedInvoicesResult', { ok, failSuffix: fails.length ? t('uploadedFailSuffix', { n: fails.length }) : '' })); onInvoiceChanged(); }
    if (fails.length) toast.error(fails.slice(0, 3).join('\n') + (fails.length > 3 ? t('moreFailedSuffix', { n: fails.length }) : ''));
  };

  const removeInvoice = async (invoice: Invoice) => {
    if (!window.confirm(t('removeInvoiceConfirm', { name: cost.name, period: invoice.period, file: invoice.file_name || t('invoiceFallbackName') }))) return;
    const res = await fetch(`/api/admin/costs/invoices?id=${invoice.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || t('removeFailed')); return;
    }
    toast.success(t('invoiceRemoved'));
    onInvoiceChanged();
  };

  return (
    <div className="border border-gray-200 rounded-xl bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
            <Wrench className="w-5 h-5 text-gray-600" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-900">{cost.name}</p>
              <StatusBadge status={cost.status} />
              {cost.status === 'review' && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-600 flex-wrap">
              {cost.category && <span>{cost.category}</span>}
              {cost.plan && <><span>·</span><span>{t('plan')} {cost.plan}</span></>}
              <span>·</span>
              <span>{BILLING_LABEL[cost.billing_cycle] || cost.billing_cycle}</span>
              {cost.renewal_date && <><span>·</span><span>{t('renewal')} {cost.renewal_date}</span></>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            {cost.monthly_cost != null ? (
              <p className="text-lg font-bold text-gray-900">{cost.currency} {cost.monthly_cost.toLocaleString()}</p>
            ) : (
              <p className="text-sm text-gray-400">{t('tbd')}</p>
            )}
            <p className="text-[11px] text-gray-500">/ {BILLING_LABEL[cost.billing_cycle] || cost.billing_cycle}</p>
          </div>
        </div>
      </div>

      {cost.note && <p className="mt-3 text-sm text-gray-600 leading-relaxed">{cost.note}</p>}

      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {/* 本月發票狀態 badge:清單非空即為已上傳 */}
          {uploaded ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200">
              <Check className="w-3.5 h-3.5" /> {t('invoiceUploadedThisMonth')}{invoices.length > 1 ? ` (${invoices.length})` : ''}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200">
              <FileText className="w-3.5 h-3.5" /> {t('invoiceNotUploadedThisMonth')}
            </span>
          )}
          {/* 歸屬月份:上傳這批算哪個月;預設當前月,補傳舊發票時改成對應月。 */}
          <select
            value={uploadPeriod}
            onChange={(e) => setUploadPeriod(e.target.value)}
            disabled={uploading}
            title={t('invoiceMonthTitle')}
            className="px-2 py-1 rounded-lg text-xs font-medium border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:border-amber-300 focus:outline-none transition-colors disabled:opacity-50"
          >
            {recentPeriods().map((p) => (
              <option key={p} value={p}>{p}{p === currentMonth ? t('thisMonthSuffix') : ''}</option>
            ))}
          </select>
          <label className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <Upload className="w-3.5 h-3.5" /> {uploading ? t('uploading') : (uploaded ? t('reuploadMulti') : t('uploadInvoiceMulti'))}
            <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden"
              onChange={(e) => { const files = Array.from(e.target.files || []); if (files.length) uploadInvoices(files); e.target.value = ''; }} />
          </label>
        </div>
        <div className="flex items-center gap-1">
          {cost.url && (
            <a href={cost.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors">
              <ExternalLink className="w-3.5 h-3.5" /> {t('manage')}
            </a>
          )}
          <button onClick={onEdit} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors" title={t('edit')}>
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title={t('delete')}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 全部發票:按「年 → 月」折疊。預設只展開今年、各月收合;點該行才看那月的發票。 */}
      {invoices.length > 0 && (
        <div className="mt-3 space-y-2">
          {grouped.map(({ year, months }) => {
            const yearOpen = openYears[year] ?? false; // 只有今年在初始 state 設 true,其餘預設收合
            const yearCount = months.reduce((s, m) => s + m.items.length, 0);
            return (
              <div key={year} className="border border-gray-100 rounded-lg overflow-hidden">
                {/* 年份層 */}
                <button
                  onClick={() => setOpenYears((p) => ({ ...p, [year]: !yearOpen }))}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  {yearOpen ? <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />}
                  <span className="text-sm font-semibold text-gray-800">{year === '未分類' ? t('uncategorized') : t('yearLabel', { year })}</span>
                  <span className="text-xs text-gray-500">{t('countInvoices', { count: yearCount })}</span>
                </button>
                {/* 月份層 */}
                {yearOpen && (
                  <div className="px-2 py-2 space-y-1.5">
                    {months.map(({ period: mPeriod, items }) => {
                      const monthOpen = openMonths[mPeriod] ?? false; // 各月預設收合
                      return (
                        <div key={mPeriod}>
                          <button
                            onClick={() => setOpenMonths((p) => ({ ...p, [mPeriod]: !monthOpen }))}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-gray-50 transition-colors text-left"
                          >
                            {monthOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                            <span className="text-xs font-medium text-gray-700">{mPeriod}</span>
                            <span className="text-xs text-gray-500">{t('countInvoices', { count: items.length })}</span>
                          </button>
                          {monthOpen && (
                            <ul className="mt-1 ml-5 space-y-1.5">
                              {items.map((inv) => (
                                <li key={inv.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                                  <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                                  <span className="text-xs text-gray-700 truncate flex-1" title={inv.file_name || undefined}>{inv.file_name || t('invoiceFallbackName')}</span>
                                  <button onClick={() => openInvoice(inv)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors shrink-0">
                                    <ExternalLink className="w-3.5 h-3.5" /> {t('viewInvoice')}
                                  </button>
                                  <button onClick={() => removeInvoice(inv)}
                                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors shrink-0" title={t('removeThisInvoice')}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
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

export default function AdminCostsPage() {
  const t = useTranslations('admin.costs');
  const [costs, setCosts] = useState<Cost[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Cost | null>(null);
  const period = currentPeriod();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cr, ir] = await Promise.all([
        fetch('/api/admin/costs'),
        // 不帶 period = 回全部發票(GET route 已支援),讓每個工具能瀏覽跨月歷史。
        // 當前月子集在前端 filter 出來給 badge / 統計 / 月結打包用。
        fetch('/api/admin/costs/invoices'),
      ]);
      if (!cr.ok) { toast.error(t('loadCostsFailed')); }
      else setCosts(await cr.json());
      if (ir.ok) setInvoices(await ir.json());
    } catch {
      toast.error(t('networkError'));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const deleteCost = async (cost: Cost) => {
    if (!window.confirm(t('deleteCostConfirm', { name: cost.name }))) return;
    const res = await fetch(`/api/admin/costs?id=${cost.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error(t('deleteFailed')); return; }
    toast.success(t('deleted'));
    load();
  };

  // 傳給每個 CostCard 的是該工具的「全部」發票(跨月歷史),折疊清單在卡片內分組。
  const invoicesFor = (costId: string) => invoices.filter((i) => i.cost_id === costId);
  // 當前月子集:給 badge / 右上統計 / 月結打包張數用(語意維持「本月」)。
  const currentMonthInvoices = invoices.filter((i) => i.period === period);

  // 每月固定支出:只加 billing='monthly' 且 monthly_cost 有值的。USD / TWD 分開加總。
  const monthlyUSD = costs.filter((c) => c.billing_cycle === 'monthly' && c.currency === 'USD' && c.monthly_cost != null)
    .reduce((s, c) => s + (c.monthly_cost || 0), 0);
  const monthlyTWD = costs.filter((c) => c.billing_cycle === 'monthly' && c.currency === 'TWD' && c.monthly_cost != null)
    .reduce((s, c) => s + (c.monthly_cost || 0), 0);
  const reviewCount = costs.filter((c) => c.status === 'review').length;
  const uploadedCount = currentMonthInvoices.length; // 本月發票總張數(打包用)
  const toolsWithInvoice = new Set(currentMonthInvoices.map((i) => i.cost_id)).size; // 本月已有發票的工具數

  const fixedLabel = [
    monthlyUSD > 0 ? `US$${monthlyUSD.toLocaleString()}` : null,
    monthlyTWD > 0 ? `NT$${monthlyTWD.toLocaleString()}` : null,
  ].filter(Boolean).join(' + ') || '—';

  const downloadZip = () => {
    // 直接開連結,由瀏覽器處理下載;無發票時 API 回 404,提示使用者。
    window.open(`/api/admin/costs/invoices/zip?period=${period}`, '_blank');
  };

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <AdminHeader
        title={t('pageTitle')}
        subtitle={t('pageSubtitle', { period })}
        action={(
          <div className="flex items-center gap-2">
            <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {t('refresh')}
            </button>
            <button onClick={() => { setEditing(null); setFormOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> {t('addTool')}
            </button>
          </div>
        )}
      />

      <AdminStats items={[
        { label: t('statMonthlyFixed'), value: fixedLabel },
        { label: t('statTotalTools'), value: costs.length },
        { label: t('statPendingReview'), value: reviewCount, color: reviewCount > 0 ? 'text-amber-700' : undefined },
        { label: t('statThisMonthInvoices', { period }), value: `${toolsWithInvoice}/${costs.length}`, color: 'text-green-700' },
      ]} />

      {/* 月結:打包本月發票給會計 */}
      <div className="flex items-center justify-between gap-3 mb-6 p-4 bg-white border border-gray-200 rounded-xl flex-wrap">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <Receipt className="w-4 h-4 text-gray-500" />
          <span>{t('monthlyCloseLabel', { period })}{t('invoiceCountSuffix', { count: uploadedCount })}</span>
        </div>
        <button onClick={downloadZip} disabled={uploadedCount === 0}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <Package className="w-4 h-4" /> {t('packageInvoicesZip')}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3" />
          <p className="text-gray-500">{t('loading')}</p>
        </div>
      ) : costs.length === 0 ? (
        <div className="text-center py-16 border border-gray-200 rounded-xl">
          <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <Receipt className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-600 font-medium">{t('noCostsTitle')}</p>
          <p className="text-gray-500 text-sm mt-1">{t('noCostsHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {costs.map((cost) => (
            <CostCard
              key={cost.id}
              cost={cost}
              invoices={invoicesFor(cost.id)}
              currentMonth={period}
              onEdit={() => { setEditing(cost); setFormOpen(true); }}
              onDelete={() => deleteCost(cost)}
              onInvoiceChanged={load}
            />
          ))}
        </div>
      )}

      {formOpen && <CostForm cost={editing} onClose={() => setFormOpen(false)} onSaved={load} />}
    </div>
  );
}
