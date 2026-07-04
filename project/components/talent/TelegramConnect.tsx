'use client';

// Compact "Connect Telegram" chip for the talent dashboard header (sits next to
// the Share button). Self-contained (pulls its own session). Renders NOTHING
// until the bot is configured server-side. After the talent binds in Telegram
// and switches back to this tab, the status auto-refreshes (window focus) — no
// manual refresh button.

import { useState, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';
import { authedFetch } from '@/lib/authed-fetch';

type State = { linked: boolean; botConfigured: boolean; link: string | null };

export default function TelegramConnect({ tx }: { tx: (a: string, b: string, c: string) => string }) {
  const [state, setState] = useState<State | null>(null);

  const load = useCallback(async () => {
    // authedFetch 內部即時 getSession 拿最新 token;沒 session 會回 401,直接略過不設 state。
    const r = await authedFetch('/api/talent/telegram');
    const j = await r.json().catch(() => ({}));
    if (r.ok) setState(j as State);
  }, []);
  useEffect(() => { load(); }, [load]);
  // Re-check when the talent returns to this tab (e.g. right after /start'ing the bot).
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  if (!state || !state.botConfigured || !state.link) return null; // dormant until bot set up

  const chip = 'inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full transition';

  if (state.linked) {
    // Done → muted grey, just confirms the state (click to unlink).
    return (
      <button type="button"
        onClick={async () => {
          if (!window.confirm(tx('取消 Telegram 綁定?', '取消 Telegram 绑定?', 'Unlink Telegram?'))) return;
          await authedFetch('/api/talent/telegram', { method: 'DELETE' }).catch(() => {});
          load();
        }}
        title={tx('Telegram 已綁定 — 點擊取消', 'Telegram 已绑定 — 点击取消', 'Telegram linked — click to unlink')}
        className={`${chip} bg-white/10 text-gray-400 hover:bg-white/15`}>
        <Send className="w-3 h-3" /> {tx('Telegram 已綁定', 'Telegram 已绑定', 'Telegram linked')}
      </button>
    );
  }
  // Not linked → prominent Telegram-blue to encourage binding.
  return (
    <a href={state.link} target="_blank" rel="noopener noreferrer"
      title={tx('綁定後案件通知會推送到 Telegram(比 Email 更即時)', '绑定后案件通知会推送到 Telegram(比邮件更即时)', 'Get instant job alerts on Telegram')}
      className={`${chip} bg-sky-500 text-white hover:bg-sky-400 font-medium`}>
      <Send className="w-3 h-3" /> {tx('綁定 Telegram', '绑定 Telegram', 'Connect Telegram')}
    </a>
  );
}
