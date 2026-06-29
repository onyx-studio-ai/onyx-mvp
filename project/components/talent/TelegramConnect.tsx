'use client';

// Talent-side "Connect Telegram" card on the talent dashboard. Self-contained
// (pulls its own session). Renders NOTHING until the bot is configured server-
// side (botConfigured), so it's invisible until TELEGRAM_BOT_USERNAME is set.

import { useState, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type State = { linked: boolean; botConfigured: boolean; link: string | null };

export default function TelegramConnect({ tx }: { tx: (a: string, b: string, c: string) => string }) {
  const [state, setState] = useState<State | null>(null);
  const [token, setToken] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const tk = data.session?.access_token || '';
    setToken(tk);
    if (!tk) return;
    const r = await fetch('/api/talent/telegram', { headers: { Authorization: `Bearer ${tk}` } });
    const j = await r.json().catch(() => ({}));
    if (r.ok) setState(j as State);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!state || !state.botConfigured || !state.link) return null; // dormant until bot set up

  async function unlink() {
    await fetch('/api/talent/telegram', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    load();
  }

  return (
    <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.05] px-4 py-3">
      <div className="flex items-center gap-2 mb-1"><Send className="w-4 h-4 text-sky-400" /><span className="text-sm font-medium text-sky-200">Telegram {tx('即時通知', '即时通知', 'notifications')}</span></div>
      {state.linked ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-300">✅ {tx('已綁定。得標、客戶訊息、修改要求會即時通知您。', '已绑定。得标、客户消息、修改要求会即时通知您。', 'Connected — you’ll be pinged for awards, messages and revision requests.')}</p>
          <button type="button" onClick={unlink} className="text-[11px] text-gray-400 hover:text-rose-300 whitespace-nowrap">{tx('取消綁定', '取消绑定', 'Unlink')}</button>
        </div>
      ) : (
        <div>
          <p className="text-xs text-gray-400 mb-2">{tx('綁定後,案件通知會同步推送到 Telegram(比 Email 更即時)。', '绑定后,案件通知会同步推送到 Telegram(比邮件更即时)。', 'Connect to get instant job alerts on Telegram alongside email.')}</p>
          <div className="flex items-center gap-3">
            <a href={state.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-sky-500 text-white hover:bg-sky-400 transition"><Send className="w-3.5 h-3.5" /> {tx('綁定 Telegram', '绑定 Telegram', 'Connect Telegram')}</a>
            <button type="button" onClick={load} className="text-[11px] text-gray-400 hover:text-gray-200">{tx('已完成?重新整理', '已完成?刷新', 'Done? Refresh')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
