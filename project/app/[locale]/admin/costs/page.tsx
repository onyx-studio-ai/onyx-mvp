'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  RefreshCw, Plus, Pencil, Trash2, ExternalLink, Receipt, Wrench,
  AlertTriangle, X, Upload, FileText, Package, Check,
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
    if (!f.name.trim()) { toast.error('請填工具名稱'); return; }
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
    if (!res.ok) { toast.error(data.error || '儲存失敗'); return; }
    toast.success(cost ? '已更新' : '已新增');
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/30 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-200 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">{cost ? '編輯工具費用' : '新增工具費用'}</h3>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">工具名稱 *</label>
            <input className={INPUT} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="例如 Supabase" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">類別</label>
              <input className={INPUT} value={f.category} onChange={(e) => set('category', e.target.value)} list="cost-categories" placeholder="資料庫 / 部署 …" />
              <datalist id="cost-categories">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">目前方案</label>
              <input className={INPUT} value={f.plan} onChange={(e) => set('plan', e.target.value)} placeholder="Free / Pro" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">月費</label>
              <input className={INPUT} type="number" min="0" step="0.01" value={f.monthly_cost} onChange={(e) => set('monthly_cost', e.target.value)} placeholder="留空=待填" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">幣別</label>
              <select className={INPUT} value={f.currency} onChange={(e) => set('currency', e.target.value)}>
                <option value="USD">USD</option>
                <option value="TWD">TWD</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">計費週期</label>
              <select className={INPUT} value={f.billing_cycle} onChange={(e) => set('billing_cycle', e.target.value)}>
                <option value="monthly">每月</option>
                <option value="yearly">年費</option>
                <option value="usage">按量</option>
                <option value="free">免費</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">續費日</label>
              <input className={INPUT} value={f.renewal_date} onChange={(e) => set('renewal_date', e.target.value)} placeholder="例如 每月 5 號 / 2027-01-15" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">狀態</label>
              <select className={INPUT} value={f.status} onChange={(e) => set('status', e.target.value)}>
                <option value="active">使用中</option>
                <option value="review">待評估升級</option>
                <option value="inactive">已停用</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">管理後台連結</label>
            <input className={INPUT} value={f.url} onChange={(e) => set('url', e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">備註</label>
            <textarea className={`${INPUT} resize-none`} rows={2} value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="例如 已超額,建議升 Pro…" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">取消</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50">{saving ? '儲存中…' : (cost ? '儲存變更' : '新增')}</button>
        </div>
      </div>
    </div>
  );
}

function CostCard({ cost, invoice, period, onEdit, onDelete, onInvoiceChanged }: {
  cost: Cost; invoice: Invoice | null; period: string;
  onEdit: () => void; onDelete: () => void; onInvoiceChanged: () => void;
}) {
  const [uploading, setUploading] = useState(false);

  const uploadInvoice = async (file: File) => {
    setUploading(true);
    try {
      // 步驟 1:拿 signed upload URL
      const prep = await fetch('/api/admin/costs/invoices', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cost_id: cost.id, period, fileName: file.name }),
      });
      const pj = await prep.json();
      if (!prep.ok) throw new Error(pj.error || '準備上傳失敗');
      // 步驟 2:上傳到 casting bucket(同專案發票上傳模式)
      const { error } = await supabase.storage.from('casting').uploadToSignedUrl(pj.path, pj.token, file);
      if (error) throw new Error(error.message);
      // 步驟 3:記一筆發票
      const rec = await fetch('/api/admin/costs/invoices', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record: true, cost_id: cost.id, period, invoice_url: pj.publicUrl, file_name: file.name }),
      });
      const rj = await rec.json();
      if (!rec.ok) throw new Error(rj.error || '記錄發票失敗');
      toast.success(`已上傳 ${cost.name} 的 ${period} 發票`);
      onInvoiceChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '上傳失敗');
    } finally {
      setUploading(false);
    }
  };

  const removeInvoice = async () => {
    if (!invoice) return;
    if (!window.confirm(`移除 ${cost.name} 的 ${period} 發票?`)) return;
    const res = await fetch(`/api/admin/costs/invoices?id=${invoice.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('移除失敗'); return; }
    toast.success('已移除發票');
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
              {cost.plan && <><span>·</span><span>方案 {cost.plan}</span></>}
              <span>·</span>
              <span>{BILLING_LABEL[cost.billing_cycle] || cost.billing_cycle}</span>
              {cost.renewal_date && <><span>·</span><span>續費 {cost.renewal_date}</span></>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            {cost.monthly_cost != null ? (
              <p className="text-lg font-bold text-gray-900">{cost.currency} {cost.monthly_cost.toLocaleString()}</p>
            ) : (
              <p className="text-sm text-gray-400">待填</p>
            )}
            <p className="text-[11px] text-gray-500">/ {BILLING_LABEL[cost.billing_cycle] || cost.billing_cycle}</p>
          </div>
        </div>
      </div>

      {cost.note && <p className="mt-3 text-sm text-gray-600 leading-relaxed">{cost.note}</p>}

      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {/* 本月發票狀態 */}
          {invoice ? (
            <a href={invoice.invoice_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors">
              <Check className="w-3.5 h-3.5" /> 本月發票已上傳
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200">
              <FileText className="w-3.5 h-3.5" /> 本月發票未上傳
            </span>
          )}
          <label className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <Upload className="w-3.5 h-3.5" /> {uploading ? '上傳中…' : (invoice ? '重新上傳' : '上傳發票')}
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadInvoice(file); e.target.value = ''; }} />
          </label>
          {invoice && (
            <button onClick={removeInvoice} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="移除本月發票">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {cost.url && (
            <a href={cost.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors">
              <ExternalLink className="w-3.5 h-3.5" /> 管理
            </a>
          )}
          <button onClick={onEdit} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors" title="編輯">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="刪除">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminCostsPage() {
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
        fetch(`/api/admin/costs/invoices?period=${period}`),
      ]);
      if (!cr.ok) { toast.error('載入費用清單失敗'); }
      else setCosts(await cr.json());
      if (ir.ok) setInvoices(await ir.json());
    } catch {
      toast.error('網路錯誤');
    }
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const deleteCost = async (cost: Cost) => {
    if (!window.confirm(`刪除「${cost.name}」?此工具的所有發票紀錄也會一併移除,無法復原。`)) return;
    const res = await fetch(`/api/admin/costs?id=${cost.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('刪除失敗'); return; }
    toast.success('已刪除');
    load();
  };

  const invoiceFor = (costId: string) => invoices.find((i) => i.cost_id === costId) || null;

  // 每月固定支出:只加 billing='monthly' 且 monthly_cost 有值的。USD / TWD 分開加總。
  const monthlyUSD = costs.filter((c) => c.billing_cycle === 'monthly' && c.currency === 'USD' && c.monthly_cost != null)
    .reduce((s, c) => s + (c.monthly_cost || 0), 0);
  const monthlyTWD = costs.filter((c) => c.billing_cycle === 'monthly' && c.currency === 'TWD' && c.monthly_cost != null)
    .reduce((s, c) => s + (c.monthly_cost || 0), 0);
  const reviewCount = costs.filter((c) => c.status === 'review').length;
  const uploadedCount = invoices.length;

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
        title="營運成本"
        subtitle={`每月支撐平台要付的工具費用一覽 · 當前月份 ${period}`}
        action={(
          <div className="flex items-center gap-2">
            <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> 重新整理
            </button>
            <button onClick={() => { setEditing(null); setFormOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> 新增工具
            </button>
          </div>
        )}
      />

      <AdminStats items={[
        { label: '每月固定支出', value: fixedLabel },
        { label: '工具總數', value: costs.length },
        { label: '待評估升級', value: reviewCount, color: reviewCount > 0 ? 'text-amber-700' : undefined },
        { label: `本月發票 (${period})`, value: `${uploadedCount}/${costs.length}`, color: 'text-green-700' },
      ]} />

      {/* 月結:打包本月發票給會計 */}
      <div className="flex items-center justify-between gap-3 mb-6 p-4 bg-white border border-gray-200 rounded-xl flex-wrap">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <Receipt className="w-4 h-4 text-gray-500" />
          <span>月結:把 <span className="font-medium">{period}</span> 已上傳的發票一次打包給會計({uploadedCount} 張)</span>
        </div>
        <button onClick={downloadZip} disabled={uploadedCount === 0}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <Package className="w-4 h-4" /> 打包本月發票 (zip)
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3" />
          <p className="text-gray-500">載入中…</p>
        </div>
      ) : costs.length === 0 ? (
        <div className="text-center py-16 border border-gray-200 rounded-xl">
          <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <Receipt className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-600 font-medium">還沒有工具費用</p>
          <p className="text-gray-500 text-sm mt-1">點右上角「新增工具」開始記錄</p>
        </div>
      ) : (
        <div className="space-y-3">
          {costs.map((cost) => (
            <CostCard
              key={cost.id}
              cost={cost}
              invoice={invoiceFor(cost.id)}
              period={period}
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
