'use client';

/*
  客戶請求 — incoming real-person voiceover requests from the public /hire form.
  These are client orders/leads (not Onyx-posted casting calls), so they live in
  the Orders area, not in 案件·發案. The brief data is stored in marketplace_briefs
  (kind='casting', status='reviewing'); once Onyx acts on it (opens a casting call
  or closes it) it leaves this list. Internal tool (admin-cookie auth, light theme).
*/

import { useState, useEffect, useCallback } from 'react';
import { caseCode } from '@/lib/casting';

type Brief = {
  id: string;
  brief_number: string;
  title: string | null;
  client_email: string;
  client_name: string | null;
  company: string | null;
  content_type: string | null;
  categories: string[] | null;
  language: string | null;
  budget: string | null;
  budget_type: string | null;
  media_scope: string | null;
  territory: string | null;
  license_term: string | null;
  length: string | null;
  script_status: string | null;
  ref_audio_url: string | null;
  has_singing: boolean | null;
  wants_director: boolean | null;
  wants_live_session: boolean | null;
  live_session_tool: string | null;
  audition_deadline: string | null;
  deadline: string | null;
  brief: string;
  status: string;
  created_at: string;
};

const ROW = (label: string, value: React.ReactNode) =>
  value ? <div className="min-w-0"><span className="text-gray-500">{label} </span><span className="text-gray-900">{value}</span></div> : null;

export default function AdminRequests() {
  const [requests, setRequests] = useState<Brief[]>([]);
  const [phase, setPhase] = useState<'loading' | 'unauth' | 'ready'>('loading');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/marketplace', { credentials: 'include' });
    if (res.status === 401) return setPhase('unauth');
    const j = await res.json().catch(() => ({}));
    // Only un-actioned client requests: came from a real client + still reviewing.
    const reqs = (j.briefs || []).filter(
      (b: Brief) => b.status === 'reviewing' && b.client_email && b.client_email !== 'casting@onyxstudios.ai',
    );
    setRequests(reqs);
    setPhase('ready');
  }, []);
  useEffect(() => { load(); }, [load]);

  async function setStatus(id: string, status: string) {
    setBusy(id);
    try {
      const res = await fetch('/api/admin/marketplace', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ kind: 'brief', id, status }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error || '更新失敗,請稍後再試'); }
    } catch { alert('網路錯誤,請稍後再試'); } finally { setBusy(null); }
    load();
  }

  if (phase === 'loading') return <div className="p-8 text-gray-500 text-sm">載入中…</div>;
  if (phase === 'unauth') return <div className="p-8 text-gray-500 text-sm">請先登入後台。</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto text-gray-900">
      <h1 className="text-xl font-semibold mb-1">客戶請求</h1>
      <p className="text-gray-500 text-sm mb-6">客戶從官網「找配音」送來的真人配音需求。先審核,需要徵選就「開試音案」,或關閉。</p>

      {requests.length === 0 && <p className="text-gray-500 text-sm">目前沒有待處理的客戶請求。</p>}

      <div className="space-y-4">
        {requests.map((b) => (
          <div key={b.id} className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <span className="font-mono text-xs text-gray-500">{caseCode(b)}</span>
                  <span className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">待審</span>
                  {b.content_type && <span className="text-[11px] bg-gray-100 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{b.content_type}</span>}
                </div>
                <p className="text-base font-semibold text-gray-900 truncate">{b.title || `${b.content_type || '配音'}需求`}</p>
              </div>
              <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">{(b.created_at || '').slice(0, 10)}</span>
            </div>

            {/* full client identity */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3 text-sm">
              <p className="text-gray-900 font-medium">{b.client_name || '—'}{b.company ? ` · ${b.company}` : ''}</p>
              <p className="text-gray-600"><a href={`mailto:${b.client_email}`} className="text-blue-600 hover:underline">{b.client_email}</a></p>
            </div>

            {/* flags */}
            {(b.has_singing || b.wants_director || b.wants_live_session) && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {b.has_singing && <span className="text-xs bg-pink-100 text-pink-800 px-2 py-0.5 rounded-full">含唱歌</span>}
                {b.wants_director && <span className="text-xs bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full">聲音導演</span>}
                {b.wants_live_session && <span className="text-xs bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full">線上監錄{b.live_session_tool ? ` · ${b.live_session_tool}` : ''}</span>}
              </div>
            )}

            <p className="text-sm text-gray-800 whitespace-pre-wrap mb-3">{b.brief}</p>

            {/* full case data */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-1.5 text-sm mb-3">
              {ROW('語言', b.language)}
              {ROW('預算', b.budget ? `${b.budget_type ? `${b.budget_type} ` : ''}${b.budget}` : null)}
              {ROW('使用範圍', b.media_scope)}
              {ROW('地區', b.territory)}
              {ROW('授權', b.license_term)}
              {ROW('長度', b.length)}
              {ROW('試音截止', b.audition_deadline)}
              {ROW('交付截止', b.deadline)}
              {ROW('稿件', b.script_status)}
              {b.ref_audio_url && ROW('參考', <a href={b.ref_audio_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{b.ref_audio_url}</a>)}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-3">
              <a href={`/admin/casting/new?from=${b.id}`} className="text-sm bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg px-3.5 py-1.5">開試音案 →</a>
              <a href={`mailto:${b.client_email}?subject=Onyx Studios — 您的配音需求`} className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 rounded-lg px-3.5 py-1.5">回覆客戶</a>
              <button onClick={() => setStatus(b.id, 'closed')} disabled={busy === b.id} className="text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-600 border border-gray-200 rounded-lg px-3.5 py-1.5">標記已處理</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
