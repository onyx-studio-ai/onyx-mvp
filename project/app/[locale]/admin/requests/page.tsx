'use client';

/*
  客戶請求 — incoming real-person voiceover requests from the public /hire form.
  These are client orders/leads (not Onyx-posted casting calls), so they live in
  the Orders area, not in 案件·發案. The brief data is stored in marketplace_briefs
  (kind='casting', status='reviewing'); once Onyx acts on it (opens a casting call
  or closes it) it leaves this list. Internal tool (admin-cookie auth, light theme).
*/

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
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
  requested_talent: string | null;
  accent: string | null;
  voices_needed: number | null;
  gender_needs: string | null;
  script_text: string | null;
  script_file_url: string | null;
  script_type: string | null;
  roles_file_url: string | null;
  local_studio_region: string | null;
  status: string;
  created_at: string;
};

const ROW = (label: string, value: React.ReactNode) =>
  value ? <div className="min-w-0"><span className="text-gray-500">{label} </span><span className="text-gray-900">{value}</span></div> : null;

export default function AdminRequests() {
  const [requests, setRequests] = useState<Brief[]>([]);
  const [phase, setPhase] = useState<'loading' | 'unauth' | 'ready'>('loading');
  const [busy, setBusy] = useState<string | null>(null);
  const [openThread, setOpenThread] = useState<string | null>(null);

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
      if (!res.ok) { const j = await res.json().catch(() => ({})); toast.error(j.error || '更新失敗,請稍後再試'); }
    } catch { toast.error('網路錯誤,請稍後再試'); } finally { setBusy(null); }
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

            {b.requested_talent && (
              <p className="text-sm mb-3 inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-2.5 py-1">
                <span className="font-semibold">🎯 指定配音員</span> {b.requested_talent}
              </p>
            )}

            {/* full case data */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-1.5 text-sm mb-3">
              {ROW('語言', b.language)}
              {ROW('口音', b.accent)}
              {ROW('配音員人數', b.voices_needed ? `${b.voices_needed}${b.voices_needed >= 3 ? '+' : ''} 位` : null)}
              {ROW('聲音性別', b.gender_needs)}
              {ROW('預算', b.budget ? `${b.budget_type ? `${b.budget_type} ` : ''}${b.budget}` : null)}
              {ROW('使用範圍', b.media_scope)}
              {ROW('地區', b.territory)}
              {ROW('授權', b.license_term)}
              {ROW('長度', b.length)}
              {ROW('當地錄音室', b.local_studio_region)}
              {ROW('試音截止', b.audition_deadline)}
              {ROW('預計完成', b.deadline)}
              {b.ref_audio_url && ROW('參考', <a href={b.ref_audio_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{b.ref_audio_url}</a>)}
            </div>

            {(b.script_text || b.script_file_url) && (
              <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-xs font-semibold text-gray-600 mb-1">
                  {b.script_type === 'final' ? '正式稿' : b.script_type === 'audition' ? '試音稿' : '稿件'}
                  {b.script_file_url && <a href={b.script_file_url} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-600 hover:underline">下載檔案 ↓</a>}
                </p>
                {b.script_text && <p className="text-sm text-gray-800 whitespace-pre-wrap max-h-40 overflow-y-auto">{b.script_text}</p>}
              </div>
            )}

            {b.roles_file_url && (
              <p className="text-sm mb-3 inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-2.5 py-1">
                <span className="font-semibold">🎭 角色表</span> <a href={b.roles_file_url} target="_blank" rel="noopener noreferrer" className="underline">下載客戶填的角色表 ↓</a>
                <span className="text-amber-600">(開試音案時會自動帶入)</span>
              </p>
            )}

            <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-3">
              <a href={`/admin/casting/new?from=${b.id}`} className="text-sm bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg px-3.5 py-1.5">開試音案 →</a>
              <button onClick={() => setOpenThread(openThread === b.id ? null : b.id)} className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 rounded-lg px-3.5 py-1.5">{openThread === b.id ? '收合訊息' : '💬 回覆客戶'}</button>
              <button onClick={() => setStatus(b.id, 'closed')} disabled={busy === b.id} className="text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-600 border border-gray-200 rounded-lg px-3.5 py-1.5">標記已處理</button>
            </div>

            {openThread === b.id && <RequestThread briefId={b.id} />}
          </div>
        ))}
      </div>
    </div>
  );
}

type Msg = { id: string; sender_type: string; sender_name: string | null; body: string; created_at: string };

// In-platform Onyx↔client thread on a request. Onyx replies as "Onyx Studios 製作團隊".
function RequestThread({ briefId }: { briefId: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/requests/messages?brief_id=${briefId}`, { credentials: 'include' });
    const j = await r.json().catch(() => ({}));
    setMsgs(j.messages || []);
  }, [briefId]);
  useEffect(() => { load(); }, [load]);
  async function send() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const r = await fetch('/api/admin/requests/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ brief_id: briefId, body }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(j.error || '送出失敗'); return; }
      setText(''); setMsgs((m) => [...m, j.message]);
    } catch { toast.error('送出失敗,請稍後再試'); } finally { setSending(false); }
  }
  return (
    <div className="mt-3 border-t border-gray-200 pt-3">
      <p className="text-xs text-gray-500 mb-2">站內訊息 · 以「Onyx Studios 製作團隊」回覆;客戶會收到通知並在自己的後台看到。</p>
      <div className="space-y-2 mb-3 max-h-72 overflow-y-auto">
        {msgs.length === 0 && <p className="text-xs text-gray-400">尚無訊息。在下方輸入即可開始對話。</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.sender_type === 'admin' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
              <div className={`text-[10px] mb-0.5 ${m.sender_type === 'admin' ? 'text-blue-100' : 'text-gray-500'}`}>{m.sender_name || (m.sender_type === 'admin' ? 'Onyx Studios' : '客戶')} · {(m.created_at || '').slice(0, 16).replace('T', ' ')}</div>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y" placeholder="輸入回覆給客戶…" />
        <button onClick={send} disabled={sending || !text.trim()} className="text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg px-4 self-end py-2">{sending ? '送出中…' : '送出'}</button>
      </div>
    </div>
  );
}
