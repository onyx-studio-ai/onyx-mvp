'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Wallet, Plus, RefreshCw, X, ChevronDown, ArrowUpCircle, ArrowDownCircle, Sliders } from 'lucide-react';

/**
 * Phase 5 — Profit First Pockets dashboard.
 *
 * Shows the 6 named pockets with current balances. Wing's mental
 * model: every income gets auto-split across these pockets when she
 * ticks "payment_received" on /admin/payouts. She spends from a
 * specific pocket here, never from the general pool.
 */

interface PocketBalance {
  id: string;
  name: string;
  display_name: string;
  display_name_zh: string;
  allocation_percent: number;
  emoji: string | null;
  sort_order: number;
  balance: number;
  inflow_total: number;
  outflow_total: number;
  txn_count: number;
}

interface PocketTransaction {
  id: string;
  pocket_id: string;
  amount: number;
  currency: string;
  type: 'income_allocation' | 'spend' | 'buyout_outflow' | 'adjustment';
  source_earning_id: string | null;
  description: string | null;
  occurred_at: string;
  created_at: string;
}

function fmtUSD(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function txnLabel(type: PocketTransaction['type']): { label: string; color: string } {
  switch (type) {
    case 'income_allocation':
      return { label: '收入分配', color: 'text-emerald-700' };
    case 'spend':
      return { label: '支出', color: 'text-red-700' };
    case 'buyout_outflow':
      return { label: '買斷支出', color: 'text-purple-700' };
    case 'adjustment':
      return { label: '手動調整', color: 'text-blue-700' };
    default:
      return { label: type, color: 'text-gray-700' };
  }
}

export default function PocketsPage() {
  const [pockets, setPockets] = useState<PocketBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [txnsByPocket, setTxnsByPocket] = useState<Record<string, PocketTransaction[]>>({});
  const [showSpendModal, setShowSpendModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  const fetchPockets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/pockets');
      const data = await res.json();
      setPockets(data.pockets || []);
    } catch {
      setPockets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTxns = useCallback(async (pocketId: string) => {
    try {
      const res = await fetch(`/api/admin/pockets/transactions?pocket_id=${pocketId}&limit=100`);
      const data = await res.json();
      setTxnsByPocket((prev) => ({ ...prev, [pocketId]: data.transactions || [] }));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchPockets();
  }, [fetchPockets]);

  const totalBalance = useMemo(
    () => pockets.reduce((sum, p) => sum + p.balance, 0),
    [pockets],
  );
  const totalInflow = useMemo(
    () => pockets.reduce((sum, p) => sum + p.inflow_total, 0),
    [pockets],
  );
  const totalOutflow = useMemo(
    () => pockets.reduce((sum, p) => sum + p.outflow_total, 0),
    [pockets],
  );

  const togglePocket = (pocket: PocketBalance) => {
    if (expandedId === pocket.id) {
      setExpandedId(null);
    } else {
      setExpandedId(pocket.id);
      if (!txnsByPocket[pocket.id]) {
        fetchTxns(pocket.id);
      }
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Wallet className="w-7 h-7 text-emerald-700" />
            Profit First 口袋
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            每筆收入自動拆 6 口袋。從口袋花錢,Profit 永遠先抽走。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchPockets}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
            title="重新整理"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowAdjustModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg border border-gray-200 transition-colors"
          >
            <Sliders className="w-4 h-4" />
            手動調整
          </button>
          <button
            onClick={() => setShowSpendModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            花錢
          </button>
        </div>
      </div>

      {/* Totals row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-gray-600 text-xs uppercase tracking-wider mb-1">Total Balance</p>
          <p className="text-2xl font-bold text-gray-900">US${fmtUSD(totalBalance)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-gray-600 text-xs uppercase tracking-wider mb-1">Total Inflow</p>
          <p className="text-2xl font-bold text-emerald-700">US${fmtUSD(totalInflow)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-gray-600 text-xs uppercase tracking-wider mb-1">Total Outflow</p>
          <p className="text-2xl font-bold text-red-700">US${fmtUSD(totalOutflow)}</p>
        </div>
      </div>

      {/* Pockets grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-600">Loading...</div>
      ) : pockets.length === 0 ? (
        <div className="text-center py-16">
          <Wallet className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No pockets configured</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pockets.map((p) => {
            const isExpanded = expandedId === p.id;
            const txns = txnsByPocket[p.id] || [];
            return (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => togglePocket(p)}
                  className="w-full text-left p-5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{p.emoji || '📁'}</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {p.display_name_zh}
                        </p>
                        <p className="text-xs text-gray-500">
                          {p.display_name} · {(p.allocation_percent * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-400 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                  <p
                    className={`text-2xl font-bold ${
                      p.balance > 0
                        ? 'text-emerald-700'
                        : p.balance < 0
                        ? 'text-red-700'
                        : 'text-gray-500'
                    }`}
                  >
                    US${fmtUSD(p.balance)}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <ArrowUpCircle className="w-3 h-3 text-emerald-600" />
                      US${fmtUSD(p.inflow_total)}
                    </span>
                    <span className="flex items-center gap-1">
                      <ArrowDownCircle className="w-3 h-3 text-red-600" />
                      US${fmtUSD(p.outflow_total)}
                    </span>
                    <span>{p.txn_count} txns</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-200 bg-gray-50 p-4 max-h-80 overflow-y-auto">
                    {txns.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-4">No transactions yet</p>
                    ) : (
                      <ul className="space-y-2">
                        {txns.map((t) => {
                          const lbl = txnLabel(t.type);
                          const amt = Number(t.amount);
                          return (
                            <li
                              key={t.id}
                              className="bg-white border border-gray-200 rounded p-2 text-xs"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className={`font-medium ${lbl.color}`}>{lbl.label}</p>
                                  {t.description && (
                                    <p className="text-gray-600 truncate" title={t.description}>
                                      {t.description}
                                    </p>
                                  )}
                                  <p className="text-[10px] text-gray-400">
                                    {new Date(t.occurred_at).toLocaleString()}
                                  </p>
                                </div>
                                <p
                                  className={`font-mono font-semibold whitespace-nowrap ${
                                    amt > 0 ? 'text-emerald-700' : 'text-red-700'
                                  }`}
                                >
                                  {amt > 0 ? '+' : ''}
                                  US${fmtUSD(amt)}
                                </p>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showSpendModal && (
        <SpendModal
          pockets={pockets}
          onClose={() => setShowSpendModal(false)}
          onSuccess={() => {
            setShowSpendModal(false);
            fetchPockets();
            // refresh open txn list if any
            if (expandedId) fetchTxns(expandedId);
          }}
        />
      )}

      {showAdjustModal && (
        <AdjustModal
          pockets={pockets}
          onClose={() => setShowAdjustModal(false)}
          onSuccess={() => {
            setShowAdjustModal(false);
            fetchPockets();
            if (expandedId) fetchTxns(expandedId);
          }}
        />
      )}
    </div>
  );
}

function SpendModal({
  pockets,
  onClose,
  onSuccess,
}: {
  pockets: PocketBalance[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [pocketName, setPocketName] = useState(pockets[0]?.name || '');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPocket = pockets.find((p) => p.name === pocketName);

  const handleSubmit = async () => {
    setError(null);
    const amt = Number(amount);
    if (!pocketName) return setError('請選口袋');
    if (!amt || amt <= 0) return setError('金額要大於 0');
    if (!description.trim()) return setError('請填用途');

    setSaving(true);
    try {
      const res = await fetch('/api/admin/pockets/spend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pocketName, amount: amt, description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '失敗');
        return;
      }
      onSuccess();
    } catch {
      setError('失敗');
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
        className="bg-white rounded-xl shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">花錢</h2>
            <p className="text-xs text-gray-500 mt-0.5">從指定口袋扣款,記錄用途</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">口袋 *</label>
            <select
              value={pocketName}
              onChange={(e) => setPocketName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {pockets.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.emoji} {p.display_name_zh} (餘額 US${fmtUSD(p.balance)})
                </option>
              ))}
            </select>
            {selectedPocket && selectedPocket.balance <= 0 && (
              <p className="text-[11px] text-amber-700 mt-1">
                ⚠️ 此口袋餘額不足,花完會變負數
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">金額 (US$) *</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="200"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">用途 *</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Facebook Ads 五月份"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
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
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
          >
            {saving ? '處理中...' : '確認花錢'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdjustModal({
  pockets,
  onClose,
  onSuccess,
}: {
  pockets: PocketBalance[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [pocketName, setPocketName] = useState(pockets[0]?.name || '');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    const amt = Number(amount);
    if (!pocketName) return setError('請選口袋');
    if (!amt || amt === 0) return setError('金額不可為 0');
    if (!description.trim()) return setError('請填用途');

    setSaving(true);
    try {
      const res = await fetch('/api/admin/pockets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adjust',
          pocketName,
          amount: amt,
          description: description.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '失敗');
        return;
      }
      onSuccess();
    } catch {
      setError('失敗');
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
        className="bg-white rounded-xl shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">手動調整</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              正數加錢進口袋,負數扣錢。用於開戶 seed / 修正錯誤。
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">口袋 *</label>
            <select
              value={pocketName}
              onChange={(e) => setPocketName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {pockets.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.emoji} {p.display_name_zh} (餘額 US${fmtUSD(p.balance)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">金額 (US$) *</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="正數 = 加錢 / 負數 = 扣錢"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">用途 *</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 開戶 seed / 修正 5/1 重複記帳"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
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
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
          >
            {saving ? '處理中...' : '確認調整'}
          </button>
        </div>
      </div>
    </div>
  );
}
