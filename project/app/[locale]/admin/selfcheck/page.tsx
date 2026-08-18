'use client';

/*
  系統自檢頁(Wing 2026-08-18:「我沒那麼多時間 double check,要能即時檢視」)。
  同一套 /api/admin/health-check 的檢查,換成手機看得懂的綠燈/紅燈清單 ——
  每日 07:00 那封信是被動通知,這頁是主動查:隨時打開就知道系統現在有沒有問題。
  唯讀,不改任何資料。
*/

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, Info, Loader2 } from 'lucide-react';

type Report = { ok: boolean; warn: string[]; info: string[]; checkedAt: string; error?: string };

export default function AdminSelfCheck() {
  const [data, setData] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = useCallback(async () => {
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/admin/health-check', { credentials: 'include', cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setData(j as Report);
    } catch (e) { setErr(e instanceof Error ? e.message : '檢查失敗'); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { run(); }, [run]);

  const fmt = (iso?: string) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }); } catch { return iso; }
  };

  return (
    <div className="p-6 lg:p-10 max-w-3xl text-gray-900">
      <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
        <h1 className="text-2xl font-bold">系統自檢</h1>
        <button onClick={run} disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-700 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />{busy ? '檢查中…' : '重新檢查'}
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-6">
        一次跑完所有一致性檢查:金額對不對、單子卡住沒、配音員資料有沒有漏。
        {data?.checkedAt ? ` 最後檢查:${fmt(data.checkedAt)}` : ''}
      </p>

      {err && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{err}</div>}

      {busy && !data ? (
        <div className="text-center py-16 text-gray-500 bg-white border border-gray-200 rounded-xl">
          <Loader2 className="w-6 h-6 animate-spin inline" />
        </div>
      ) : data ? (
        <>
          {/* 總結燈號 */}
          <div className={`rounded-2xl px-5 py-4 mb-5 border ${data.warn.length ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center gap-3">
              {data.warn.length
                ? <AlertTriangle className="w-7 h-7 text-red-600 shrink-0" />
                : <CheckCircle2 className="w-7 h-7 text-green-600 shrink-0" />}
              <div>
                <p className={`text-lg font-bold ${data.warn.length ? 'text-red-800' : 'text-green-800'}`}>
                  {data.warn.length ? `${data.warn.length} 項需要處理` : '一切正常'}
                </p>
                <p className="text-sm text-gray-600">
                  {data.warn.length ? '下面每一項都會影響實際運作(錢、交件、通知),請逐項處理' : '沒有發現異常;下方是參考資訊'}
                </p>
              </div>
            </div>
          </div>

          {/* 異常項 */}
          {data.warn.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">需要處理</h2>
              <div className="space-y-2">
                {data.warn.map((w, i) => (
                  <div key={i} className="flex gap-2.5 bg-white border border-red-200 rounded-xl px-4 py-3">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-800 leading-relaxed break-words">{w}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 資訊項 */}
          {data.info.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">參考資訊(不影響運作)</h2>
              <div className="space-y-2">
                {data.info.map((x, i) => (
                  <div key={i} className="flex gap-2.5 bg-white border border-gray-200 rounded-xl px-4 py-3">
                    <Info className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-600 leading-relaxed break-words">{x}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400 mt-6 leading-relaxed">
            同一套檢查每天台北時間 07:00 自動跑一次,有「需要處理」的項目才會寄信通知。
            這頁是隨時想看就看的即時版。
          </p>
        </>
      ) : null}
    </div>
  );
}
