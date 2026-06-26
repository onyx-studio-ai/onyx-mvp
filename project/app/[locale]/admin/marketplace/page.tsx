'use client';

/*
  Admin marketplace — Onyx mediates briefs + quotes (managed model).
  Lists briefs with their quotes; lets Onyx shortlist / accept / reject quotes
  and move briefs through their states. Accepting a quote awards the brief.
  Internal tool (admin-cookie auth). Light theme to match the admin shell.
*/

import { useState, useEffect, useCallback } from 'react';
import { caseCode } from '@/lib/casting';

const SITE = 'https://www.onyxstudios.ai';

type Brief = {
  id: string;
  brief_number: string;
  kind: string | null;        // 'casting' = our self-posted audition call
  title: string | null;
  client_email: string;
  client_name: string | null;
  company: string | null;
  categories: string[] | null;
  content_type: string | null;
  media_scope: string | null;
  territory: string | null;
  license_term: string | null;
  script_status: string | null;
  has_singing: boolean | null;
  wants_director: boolean | null;
  wants_live_session: boolean | null;
  live_session_tool: string | null;
  audition_deadline: string | null;
  language: string | null;
  length: string | null;
  budget: string | null;
  budget_type: string | null;
  deadline: string | null;
  brief: string;
  status: string;
  awarded_quote_id: string | null;
  created_at: string;
};
type Quote = {
  id: string;
  brief_id: string;
  talent_id: string;
  gross_amount: number;
  net_amount: number;
  commission_rate: number;
  currency: string;
  message: string | null;
  status: string;
  created_at: string;
  talents?: { name: string; email: string } | null;
};

const BRIEF_NEXT: Record<string, string[]> = {
  open: ['reviewing', 'closed', 'cancelled'],
  reviewing: ['open', 'closed', 'cancelled'],
  awarded: ['closed'],
  closed: ['open'],
  cancelled: ['open'],
};

export default function AdminMarketplace() {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [phase, setPhase] = useState<'loading' | 'unauth' | 'ready'>('loading');
  const [unavailable, setUnavailable] = useState(false);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/marketplace', { credentials: 'include' });
    if (res.status === 401) return setPhase('unauth');
    const j = await res.json().catch(() => ({}));
    setBriefs(j.briefs || []);
    setQuotes(j.quotes || []);
    setUnavailable(!!j.unavailable);
    setPhase('ready');
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(kind: 'brief' | 'quote', id: string, status: string) {
    await fetch('/api/admin/marketplace', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ kind, id, status }),
    });
    load();
  }

  if (phase === 'loading') return <div className="p-8 text-gray-500 text-sm">載入中…</div>;
  if (phase === 'unauth') return <div className="p-8 text-gray-500 text-sm">請先登入後台。</div>;

  const quotesFor = (briefId: string) => quotes.filter((q) => q.brief_id === briefId);

  return (
    <div className="p-6 max-w-4xl mx-auto text-gray-900">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold">案源與報價 Marketplace</h1>
        <a href="/admin/casting/new" className="text-sm bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg px-3 py-1.5">+ 發案(試音案)</a>
      </div>
      <p className="text-gray-500 text-sm mb-6">客戶發案 + 配音員報價,由 Onyx 居中媒合。「+ 發案」開人聲試音案。</p>

      {unavailable && (
        <div className="mb-4 text-amber-800 text-sm bg-amber-50 border border-amber-200 rounded-lg p-3">
          ⚠️ marketplace 資料表尚未建立 —— 請先跑 migration <code>20260620120000_marketplace_briefs_quotes.sql</code>。
        </div>
      )}

      {briefs.length === 0 && !unavailable && <p className="text-gray-500 text-sm">目前沒有案源。</p>}

      <div className="space-y-5">
        {briefs.map((b) => (
          <div key={b.id} className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs text-gray-500">{b.kind === 'casting' ? caseCode(b) : b.brief_number}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${b.status === 'open' ? 'bg-green-100 text-green-700' : b.status === 'awarded' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                {b.status}
              </span>
            </div>
            {b.kind === 'casting' ? (
              <div className="mb-2">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">試音案</span>
                  {b.title && <span className="text-sm font-medium text-gray-900">{b.title}</span>}
                </div>
                {/* shareable open link — paste into WeChat/LINE; anyone joins & auditions without registering */}
                <div className="flex items-center gap-2">
                  <input readOnly value={`${SITE}/casting/join/${b.id}`} onFocus={(e) => e.target.select()}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 font-mono" />
                  <button onClick={() => { navigator.clipboard?.writeText(`${SITE}/casting/join/${b.id}`); setCopiedId(b.id); setTimeout(() => setCopiedId(null), 1500); }}
                    className="text-xs bg-gray-900 hover:bg-gray-700 text-white rounded px-2.5 py-1 whitespace-nowrap">{copiedId === b.id ? '已複製 ✓' : '🔗 複製試音連結'}</button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-700 mb-1">
                {b.client_name || '—'} {b.company ? `· ${b.company}` : ''} · <span className="text-gray-500">{b.client_email}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-1.5 my-2">
              {b.content_type && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">{b.content_type}</span>}
              {b.has_singing && <span className="text-xs bg-pink-100 text-pink-800 px-2 py-0.5 rounded-full">含唱歌</span>}
              {b.wants_live_session && <span className="text-xs bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full">線上同步錄音{b.live_session_tool ? ` · ${b.live_session_tool}` : ''}</span>}
              {b.wants_director && <span className="text-xs bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full">聲音導演</span>}
              {!b.content_type && (b.categories || []).map((c, i) => (
                <span key={i} className="text-xs bg-gray-100 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{c}</span>
              ))}
              {b.language && <span className="text-xs text-green-700">{b.language}</span>}
            </div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap mb-2">{b.brief}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
              {b.media_scope && <span>媒體 {b.media_scope}</span>}
              {b.territory && <span>地區 {b.territory}</span>}
              {b.license_term && <span>授權 {b.license_term}</span>}
              {b.length && <span>長度 {b.length}</span>}
              {b.budget && <span>預算 {b.budget_type ? `${b.budget_type} ` : ''}{b.budget}</span>}
              {b.audition_deadline && <span>試音截止 {b.audition_deadline}</span>}
              {b.deadline && <span>交付截止 {b.deadline}</span>}
              {b.script_status && <span>稿件 {b.script_status}</span>}
            </div>

            {/* brief status controls */}
            <div className="flex flex-wrap gap-2 mb-3">
              {(BRIEF_NEXT[b.status] || []).map((s) => (
                <button key={s} onClick={() => patch('brief', b.id, s)} className="text-xs bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 rounded-lg px-2.5 py-1 transition">
                  → {s}
                </button>
              ))}
            </div>

            {/* quotes */}
            <div className="border-t border-gray-200 pt-3 space-y-2">
              {quotesFor(b.id).length === 0 && <p className="text-xs text-gray-400">尚無報價</p>}
              {quotesFor(b.id).map((q) => {
                const tkey = `${b.id}:${q.talent_id}`;
                return (
                  <div key={q.id}>
                    <div className="flex items-center justify-between gap-3 text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <span className="text-gray-800">{q.talents?.name || '配音員'}</span>
                        {b.kind === 'casting' ? (
                          <span className="text-gray-500 ml-2">報價 {q.currency} {q.gross_amount} <span className="text-gray-400">(平台不抽成)</span></span>
                        ) : (
                          <span className="text-gray-500 ml-2">
                            客戶付 {q.currency} {q.gross_amount} · 淨得 {q.currency} {q.net_amount}{' '}
                            <span className="text-gray-400">({Math.round(q.commission_rate * 100)}%)</span>
                          </span>
                        )}
                        {q.message && <p className="text-xs text-gray-500 truncate">{q.message}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => setOpenThread(openThread === tkey ? null : tkey)} className="text-xs bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded px-2 py-0.5" title="訊息">💬</button>
                        <span className={`text-xs ${q.status === 'accepted' ? 'text-blue-700' : q.status === 'rejected' || q.status === 'withdrawn' ? 'text-gray-400' : 'text-green-700'}`}>{q.status}</span>
                        {['submitted', 'shortlisted'].includes(q.status) && (
                          <>
                            {q.status === 'submitted' && (
                              <button onClick={() => patch('quote', q.id, 'shortlisted')} className="text-xs bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 rounded px-2 py-0.5">入圍</button>
                            )}
                            <button onClick={() => patch('quote', q.id, 'accepted')} className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded px-2 py-0.5">採用</button>
                            <button onClick={() => patch('quote', q.id, 'rejected')} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded px-2 py-0.5">婉拒</button>
                          </>
                        )}
                      </div>
                    </div>
                    {openThread === tkey && <AdminThread briefId={b.id} talentId={q.talent_id} />}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminThread({ briefId, talentId }: { briefId: string; talentId: string }) {
  const [messages, setMessages] = useState<{ id: string; sender_type: string; sender_name: string | null; body: string }[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/marketplace/messages?brief_id=${briefId}&talent_id=${talentId}`, { credentials: 'include' });
    const j = await res.json().catch(() => ({}));
    setMessages(j.messages || []);
  }, [briefId, talentId]);
  useEffect(() => {
    load();
  }, [load]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    await fetch('/api/admin/marketplace/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ brief_id: briefId, talent_id: talentId, body }),
    });
    setBusy(false);
    setDraft('');
    load();
  }

  return (
    <div className="ml-3 mt-1 mb-2 border-l-2 border-gray-200 pl-3">
      <div className="space-y-1.5 max-h-60 overflow-y-auto py-1">
        {messages.length === 0 && <p className="text-xs text-gray-400">尚無訊息</p>}
        {messages.map((m) => (
          <div key={m.id} className="text-xs">
            <span className={m.sender_type === 'admin' ? 'text-blue-700' : m.sender_type === 'talent' ? 'text-green-700' : 'text-gray-600'}>
              {m.sender_type === 'admin' ? 'Onyx' : m.sender_name || m.sender_type}:
            </span>{' '}
            <span className="text-gray-800 whitespace-pre-wrap">{m.body}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              send();
            }
          }}
          placeholder="以 Onyx 身分回覆…"
          className="flex-1 bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-900"
        />
        <button onClick={send} disabled={busy || !draft.trim()} className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded px-2 disabled:opacity-50">
          送出
        </button>
      </div>
    </div>
  );
}
