'use client';

/*
  Unified marketplace messages (Phase 4). Login-gated; works for both clients
  (briefs they posted) and talents (briefs they quoted on). A thread = (brief,
  talent). Closed/on-platform; Onyx can read every thread via the admin view.

  Rendered standalone at /messages (clients — pads for the fixed navbar) and
  embedded under /talent/messages (talents — the talent dashboard layout already
  provides the navbar clearance + sidebar, so we drop the top padding there).
*/

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type Thread = {
  key: string; brief_id: string; talent_id: string; role: 'client' | 'talent';
  brief_number: string; title: string; brief_status: string; counterpart: string;
  last_at?: string | null; last_sender_type?: string | null; last_preview?: string | null;
};
type Msg = { id: string; sender_type: string; sender_name: string | null; body: string; created_at: string };

const inputCls =
  'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-400/60 transition';

export default function MessagesView({ embedded = false, filterRole }: { embedded?: boolean; filterRole?: 'client' | 'talent' }) {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  const [phase, setPhase] = useState<'loading' | 'nologin' | 'ready'>('loading');
  const [token, setToken] = useState('');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [, setReadTick] = useState(0); // bump to re-render after marking a thread read
  const endRef = useRef<HTMLDivElement | null>(null);

  // A thread is unread when its latest message is from the OTHER party and is newer
  // than the last time this device opened it (stored in localStorage — no schema).
  // Plain function (recomputed each render; setReadTick forces a render after open).
  const isUnread = (t: Thread) => {
    if (!t.last_at || !t.last_sender_type || t.last_sender_type === t.role) return false;
    const seen = (typeof window !== 'undefined' && window.localStorage.getItem(`mpRead:${t.key}`)) || '';
    return seen < t.last_at;
  };
  const markRead = useCallback((t: Thread) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(`mpRead:${t.key}`, t.last_at || new Date().toISOString());
    setReadTick((x) => x + 1);
  }, []);

  const loadThreads = useCallback(async (accessToken: string) => {
    setToken(accessToken);
    const res = await fetch('/api/marketplace/threads', { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.status === 401) return setPhase('nologin');
    const j = await res.json().catch(() => ({}));
    setThreads(j.threads || []);
    setPhase('ready');
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) await loadThreads(data.session.access_token);
      else setPhase('nologin');
    })();
  }, [loadThreads]);

  const openThread = useCallback(
    async (t: Thread) => {
      setActive(t);
      setMessages([]);
      setErr('');
      markRead(t);
      const res = await fetch(`/api/marketplace/messages?brief_id=${t.brief_id}&talent_id=${t.talent_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => ({}));
      setMessages(j.messages || []);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    },
    [token, markRead]
  );

  // Deep-link: ?brief=<id> (from an awarded case page) auto-opens that thread, so
  // the client/talent lands straight in the right conversation. Placed after
  // openThread so it isn't referenced before initialization.
  useEffect(() => {
    if (phase !== 'ready' || active || !threads.length) return;
    const want = new URLSearchParams(window.location.search).get('brief');
    if (!want) return;
    const t = threads.find((x) => x.brief_id === want && (!filterRole || x.role === filterRole));
    if (t) openThread(t);
  }, [phase, threads, active, filterRole, openThread]);

  async function send() {
    const body = draft.trim();
    if (!body || !active) return;
    setBusy(true);
    setErr('');
    const res = await fetch('/api/marketplace/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ brief_id: active.brief_id, talent_id: active.talent_id, body }),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(j.error || tx('送出失敗', '送出失败', 'Send failed'));
    setMessages((m) => [...m, j.message]);
    setDraft('');
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  const shell = (inner: React.ReactNode) => (
    <main className={`min-h-screen bg-black text-white px-4 ${embedded ? 'py-8' : 'pt-28 pb-12'}`}>
      <div className="max-w-2xl mx-auto">{inner}</div>
    </main>
  );

  if (phase === 'loading') return shell(<p className="text-gray-500 text-sm text-center py-20">{tx('載入中…', '加载中…', 'Loading…')}</p>);

  if (phase === 'nologin') {
    return shell(
      <div className="text-center py-16">
        <h1 className="text-xl font-semibold mb-3">{tx('訊息', '消息', 'Messages')}</h1>
        <p className="text-gray-400 text-sm mb-6">{tx('請先登入以查看訊息。', '请先登录以查看消息。', 'Please sign in to view your messages.')}</p>
        <div className="flex items-center justify-center gap-4 text-sm">
          <Link href="/auth" className="text-green-400 hover:underline">{tx('客戶登入', '客户登录', 'Client sign in')}</Link>
          <Link href="/talent" className="text-green-400 hover:underline">{tx('配音員登入', '配音员登录', 'Talent sign in')}</Link>
        </div>
      </div>
    );
  }

  // thread view
  if (active) {
    return shell(
      <div className="flex flex-col h-[70vh]">
        <button onClick={() => setActive(null)} className="text-xs text-gray-400 hover:text-white transition mb-2 self-start">← {tx('所有對話', '所有对话', 'All threads')}</button>
        {/* case name + number prominent, then who you're talking to */}
        <div className="mb-3">
          <h2 className="text-base font-semibold text-white truncate">{active.title || tx('配音案', '配音案', 'Voice case')}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            <span className="font-mono">{active.brief_number}</span> · {tx('與', '与', 'With')} <span className="text-gray-300">{active.counterpart}</span>
          </p>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 bg-white/[0.02] border border-white/10 rounded-xl p-4">
          {messages.length === 0 && <p className="text-gray-600 text-sm text-center py-8">{tx('還沒有訊息,開始對話吧。', '还没有消息,开始对话吧。', 'No messages yet — say hello.')}</p>}
          {messages.map((m) => {
            const mine = m.sender_type === active.role;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'bg-green-500/20 text-green-50' : m.sender_type === 'admin' ? 'bg-blue-500/15 text-blue-100' : 'bg-white/10 text-gray-100'}`}>
                  {!mine && <p className="text-[10px] text-gray-400 mb-0.5">{m.sender_type === 'admin' ? 'Onyx' : m.sender_name}</p>}
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
        {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
        <div className="flex gap-2 mt-3">
          <input
            className={inputCls}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={tx('輸入訊息…', '输入消息…', 'Type a message…')}
          />
          <button onClick={send} disabled={busy || !draft.trim()} className="shrink-0 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold rounded-lg px-4 text-sm transition">
            {tx('送出', '送出', 'Send')}
          </button>
        </div>
      </div>
    );
  }

  // thread list — optionally scoped to one role (talent vs client side)
  const shownThreads = filterRole ? threads.filter((t) => t.role === filterRole) : threads;
  return shell(
    <>
      <h1 className="text-2xl font-semibold mb-6">{tx('訊息', '消息', 'Messages')}</h1>
      {shownThreads.length === 0 && <p className="text-gray-500 text-sm text-center py-16">{tx('目前沒有對話。成單後(客戶選定配音員)雙方就能在這裡直接聯繫。', '目前没有对话。成单后(客户选定配音员)双方就能在这里直接联系。', 'No threads yet. Once a job is awarded, you and the other party can message here.')}</p>}
      <div className="space-y-2">
        {shownThreads.map((t) => {
          const unread = isUnread(t);
          return (
          <button key={t.key} onClick={() => openThread(t)} className={`w-full text-left border rounded-xl p-4 transition ${unread ? 'bg-green-500/[0.07] border-green-400/30 hover:bg-green-500/[0.1]' : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/10'}`}>
            {/* lead with the CASE (name + number) so it's clear which job this is */}
            <div className="flex items-start gap-2 mb-1">
              {unread && <span className="w-2 h-2 rounded-full bg-green-400 shrink-0 mt-1.5" aria-label={tx('未讀', '未读', 'unread')} />}
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold truncate ${unread ? 'text-white' : 'text-gray-200'}`}>{t.title || tx('配音案', '配音案', 'Voice case')}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  <span className="font-mono">{t.brief_number}</span> · {tx('與', '与', 'With')} <span className="text-gray-300">{t.counterpart}</span>
                </p>
              </div>
              {unread && <span className="text-[10px] text-green-300 shrink-0 whitespace-nowrap">{tx('新訊息', '新消息', 'New')}</span>}
            </div>
            {t.last_preview && (
              <p className={`text-xs truncate ${unread ? 'text-gray-200' : 'text-gray-500'}`}>
                {t.last_sender_type === t.role ? tx('你:', '你:', 'You: ') : ''}{t.last_preview}
              </p>
            )}
          </button>
          );
        })}
      </div>
    </>
  );
}
