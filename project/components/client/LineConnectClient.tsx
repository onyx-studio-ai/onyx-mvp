'use client';

// 客戶儀表板的「綁定 LINE 通知」chip(對應 /api/client/line;身分=登入 email)。
// 與配音員版 LineConnect 同款兩步流程:加官方帳號好友 → 傳 6 碼綁定碼。
// 伺服器沒設金鑰時整顆不出現。

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Copy } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type State = { linked: boolean; configured: boolean; oaUrl: string | null; code: string | null };

export default function LineConnectClient({ tx }: { tx: (a: string, b: string, c: string) => string }) {
  const [state, setState] = useState<State | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const r = await fetch('/api/client/line', { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json().catch(() => ({}));
    if (r.ok) setState(j as State);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  if (!state || !state.configured) return null;

  const chip = 'inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full transition';

  if (state.linked) {
    return (
      <button type="button"
        onClick={async () => {
          if (!window.confirm(tx('取消 LINE 綁定?', '取消 LINE 绑定?', 'Unlink LINE?'))) return;
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (token) await fetch('/api/client/line', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
          load();
        }}
        title={tx('LINE 已綁定 — 點擊取消', 'LINE 已绑定 — 点击取消', 'LINE linked — click to unlink')}
        className={`${chip} bg-white/10 text-gray-400 hover:bg-white/15`}>
        <MessageSquare className="w-3 h-3" /> {tx('LINE 已綁定', 'LINE 已绑定', 'LINE linked')}
      </button>
    );
  }

  return (
    <span className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        title={tx('綁定後試音/交付/案件通知會同步推到 LINE', '绑定后试音/交付/案件通知会同步推到 LINE', 'Get project updates on LINE')}
        className={`${chip} bg-[#06C755] text-white hover:brightness-110 font-medium`}>
        <MessageSquare className="w-3 h-3" /> {tx('綁定 LINE 通知', '绑定 LINE 通知', 'Connect LINE')}
      </button>
      {open && (
        <span className="absolute right-0 top-7 z-30 block w-72 rounded-xl border border-white/15 bg-[#1d1b25] p-3 text-left shadow-xl">
          <span className="block text-xs text-gray-300 mb-2">{tx('兩步完成綁定:', '两步完成绑定:', 'Two steps:')}</span>
          {state.oaUrl && (
            <a href={state.oaUrl} target="_blank" rel="noopener noreferrer"
              className="block text-center text-xs bg-[#06C755] text-white rounded-lg px-3 py-2 mb-2 hover:brightness-110">
              {tx('① 加入官方帳號好友', '① 加入官方账号好友', '① Add our official account')}
            </a>
          )}
          <span className="block text-xs text-gray-300 mb-1">{tx('② 把這組綁定碼傳到聊天室:', '② 把这组绑定码传到聊天室:', '② Send this code in the chat:')}</span>
          <button type="button"
            onClick={() => { if (state.code) { navigator.clipboard?.writeText(state.code); setCopied(true); setTimeout(() => setCopied(false), 1500); } }}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-base font-bold tracking-[0.3em] text-white hover:bg-white/10">
            {state.code || '——'} <Copy className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <span className="block text-[10px] text-gray-500 mt-1.5">
            {copied ? tx('已複製!', '已复制!', 'Copied!') : tx('點擊可複製。傳送後回到本頁即完成。', '点击可复制。传送后回到本页即完成。', 'Click to copy. Send it, then come back here.')}
          </span>
        </span>
      )}
    </span>
  );
}
