'use client';

// 客戶儀表板的「綁定 Telegram」chip(對應 /api/client/telegram)。
// Telegram 有帶參數 deep-link,一步完成:點連結 → bot 裡按 Start 即綁。
// 伺服器沒設 bot 時整顆不出現。

import { useState, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type State = { linked: boolean; botConfigured: boolean; link: string | null };

export default function TelegramConnectClient({ tx }: { tx: (a: string, b: string, c: string) => string }) {
  const [state, setState] = useState<State | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const r = await fetch('/api/client/telegram', { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json().catch(() => ({}));
    if (r.ok) setState(j as State);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  if (!state || !state.botConfigured) return null;

  const chip = 'inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full transition';

  if (state.linked) {
    return (
      <button type="button"
        onClick={async () => {
          if (!window.confirm(tx('取消 Telegram 綁定?', '取消 Telegram 绑定?', 'Unlink Telegram?'))) return;
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (token) await fetch('/api/client/telegram', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
          load();
        }}
        title={tx('Telegram 已綁定 — 點擊取消', 'Telegram 已绑定 — 点击取消', 'Telegram linked — click to unlink')}
        className={`${chip} bg-white/10 text-gray-400 hover:bg-white/15`}>
        <Send className="w-3 h-3" /> {tx('Telegram 已綁定', 'Telegram 已绑定', 'Telegram linked')}
      </button>
    );
  }
  if (!state.link) return null;
  return (
    <a href={state.link} target="_blank" rel="noopener noreferrer"
      title={tx('綁定後平台通知會同步推到 Telegram', '绑定后平台通知会同步推到 Telegram', 'Get project updates on Telegram')}
      className={`${chip} bg-sky-500 text-white hover:bg-sky-400 font-medium`}>
      <Send className="w-3 h-3" /> {tx('綁定 Telegram', '绑定 Telegram', 'Connect Telegram')}
    </a>
  );
}
