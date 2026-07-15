'use client';

/*
  表單自動草稿(localStorage)— 長表單打到一半沒空完成,關頁不再全丟。
  Wing 2026-07-15 要求:全站掃過,發案表單 / 客戶發案 / 報名表都是「一次性」,沒存檔。

  用法:
    const draft = useFormDraft('casting-new', snapshot, (d) => { ...還原各 setState });
    - snapshot:要保存的欄位組成的可序列化物件(每次 render 傳入,內部 debounce 寫入)
    - 有舊草稿時 draft.pending 非空 → 頁面頂部渲染 <DraftBanner draft={draft} />,
      使用者選「恢復」或「丟棄」前不會寫入(避免空表單把草稿蓋掉)。
    - 送出成功後呼叫 draft.clear()。
*/

import { useEffect, useRef, useState, useCallback } from 'react';

const PREFIX = 'onyx-draft:';

export function useFormDraft<T>(key: string, snapshot: T, applySnapshot: (d: T) => void, enabled = true) {
  const storageKey = PREFIX + key;
  const [pending, setPending] = useState<{ savedAt: number; data: T } | null>(null);
  const [hold, setHold] = useState(true);            // 使用者對舊草稿做出選擇前,不寫入
  const applyRef = useRef(applySnapshot);
  applyRef.current = applySnapshot;

  // mount:偵測舊草稿
  useEffect(() => {
    if (!enabled) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { savedAt: number; data: T };
        if (parsed && parsed.data) { setPending(parsed); return; }   // hold 維持 true
      }
    } catch { /* 草稿壞掉就當沒有 */ }
    setHold(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, enabled]);

  // 自動寫入(debounce 800ms)
  const json = JSON.stringify(snapshot);
  useEffect(() => {
    if (!enabled || hold) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify({ savedAt: Date.now(), data: snapshot })); } catch { /* 滿了就算了 */ }
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [json, hold, enabled, storageKey]);

  const restore = useCallback(() => {
    if (pending) applyRef.current(pending.data);
    setPending(null); setHold(false);
  }, [pending]);

  const discard = useCallback(() => {
    try { localStorage.removeItem(storageKey); } catch { /* noop */ }
    setPending(null); setHold(false);
  }, [storageKey]);

  const clear = useCallback(() => {
    try { localStorage.removeItem(storageKey); } catch { /* noop */ }
    setHold(true);   // 送出成功後停止再寫(避免成功頁殘留又寫回)
  }, [storageKey]);

  return { pending, restore, discard, clear };
}

/** 舊草稿提示條 —— 有 pending 才渲染。深/淺底自動由呼叫端頁面風格決定(這裡用中性色)。 */
export function DraftBanner({ draft, tx }: {
  draft: { pending: { savedAt: number } | null; restore: () => void; discard: () => void };
  tx?: (tw: string, cn: string, en: string) => string;
}) {
  if (!draft.pending) return null;
  const t = tx || ((tw: string) => tw);
  const mins = Math.max(1, Math.round((Date.now() - draft.pending.savedAt) / 60000));
  const ago = mins < 60 ? t(`${mins} 分鐘前`, `${mins} 分钟前`, `${mins}m ago`) : mins < 1440 ? t(`${Math.round(mins / 60)} 小時前`, `${Math.round(mins / 60)} 小时前`, `${Math.round(mins / 60)}h ago`) : t(`${Math.round(mins / 1440)} 天前`, `${Math.round(mins / 1440)} 天前`, `${Math.round(mins / 1440)}d ago`);
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-400/50 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30">
      <span>📝 {t('這裡有你上次沒寫完的草稿', '这里有你上次没写完的草稿', 'You have an unfinished draft')}({ago}{t('自動儲存', '自动保存', 'auto-saved')})。</span>
      <button type="button" onClick={draft.restore} className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-medium text-black hover:bg-amber-400">{t('恢復草稿', '恢复草稿', 'Restore')}</button>
      <button type="button" onClick={draft.discard} className="rounded-lg border border-amber-500/50 px-3 py-1 text-xs text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-500/10">{t('丟棄,重新開始', '丢弃,重新开始', 'Discard')}</button>
    </div>
  );
}
