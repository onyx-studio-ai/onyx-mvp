'use client';

// 「綁定 Discord」chip,與 TelegramConnect 同款:server 端沒設 Discord 金鑰就
// 完全不渲染(休眠);點擊走 OAuth 授權,授權完自動加入 Onyx 伺服器並綁定,
// 回到本頁(window focus)自動刷新狀態。

import { useState, useEffect, useCallback } from 'react';
import { MessageCircle } from 'lucide-react';
import { authedFetch } from '@/lib/authed-fetch';

type State = { linked: boolean; botConfigured: boolean; link: string | null };

export default function DiscordConnect({ tx }: { tx: (a: string, b: string, c: string) => string }) {
  const [state, setState] = useState<State | null>(null);

  const load = useCallback(async () => {
    const r = await authedFetch('/api/talent/discord');
    const j = await r.json().catch(() => ({}));
    if (r.ok) setState(j as State);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  if (!state || !state.botConfigured || (!state.link && !state.linked)) return null;

  const chip = 'inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full transition';

  if (state.linked) {
    return (
      <button type="button"
        onClick={async () => {
          if (!window.confirm(tx('取消 Discord 綁定?', '取消 Discord 绑定?', 'Unlink Discord?'))) return;
          await authedFetch('/api/talent/discord', { method: 'DELETE' }).catch(() => {});
          load();
        }}
        title={tx('Discord 已綁定 — 點擊取消', 'Discord 已绑定 — 点击取消', 'Discord linked — click to unlink')}
        className={`${chip} bg-white/10 text-gray-400 hover:bg-white/15`}>
        <MessageCircle className="w-3 h-3" /> {tx('Discord 已綁定', 'Discord 已绑定', 'Discord linked')}
      </button>
    );
  }
  return (
    <a href={state.link!} target="_blank" rel="noopener noreferrer"
      title={tx('綁定後案件通知會推送到 Discord(比 Email 更即時)', '绑定后案件通知会推送到 Discord(比邮件更即时)', 'Get instant job alerts on Discord')}
      className={`${chip} bg-indigo-500 text-white hover:bg-indigo-400 font-medium`}>
      <MessageCircle className="w-3 h-3" /> {tx('綁定 Discord', '绑定 Discord', 'Connect Discord')}
    </a>
  );
}
