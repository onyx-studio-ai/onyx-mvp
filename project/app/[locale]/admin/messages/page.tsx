'use client';

/*
  訊息中心 — 全部對話串一頁總覽(Wing 2026-07-16:對話散在各案的 💬 裡,
  不點進去不知道誰回了)。左:串列(未讀紅點,最新在上);右:對話+回覆。
  開啟串自動標已讀;回覆走既有 /api/admin/marketplace/messages(自動通知對方)。
*/

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

type Thread = { thread_key: string; brief_id: string; talent_id: string; brief_title: string; brief_number: string; talent_name: string; last_body: string; last_at: string; last_sender: string; count: number; unread: boolean };
type Msg = { id: string; sender_type: string; sender_name?: string | null; body: string; attachments?: { name: string; url: string }[] | null; created_at: string };

const input = 'w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500';
const fmtT = (s: string) => String(s).slice(5, 16).replace('T', ' ');

export default function AdminMessages() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState<Thread | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<{ name: string; url: string }[]>([]);   // 待送附件(圖/文件;只有後台能傳)
  const [uploading, setUploading] = useState(false);
  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const u = await fetch('/api/admin/casting/upload', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name }) });
      const uj = await u.json().catch(() => ({}));
      if (!u.ok || !uj.path) throw new Error(uj.error || '上傳準備失敗');
      const { error } = await supabase.storage.from('casting').uploadToSignedUrl(uj.path, uj.token, file);
      if (error) throw new Error(error.message);
      setFiles((f) => [...f, { name: file.name, url: uj.publicUrl }]);
    } catch (e) { toast.error(e instanceof Error ? e.message : '附件上傳失敗'); } finally { setUploading(false); }
  }

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/messages-inbox', { credentials: 'include' });
    const j = await res.json().catch(() => ({}));
    setThreads(j.threads || []);
    setLoaded(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function open(t: Thread) {
    setActive(t); setMsgs([]); setText(''); setFiles([]);
    const res = await fetch(`/api/admin/marketplace/messages?brief_id=${encodeURIComponent(t.brief_id)}&talent_id=${encodeURIComponent(t.talent_id)}`, { credentials: 'include' });
    const j = await res.json().catch(() => ({}));
    setMsgs(j.messages || []);
    // 開啟即已讀
    fetch('/api/admin/messages-inbox', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ thread_key: t.thread_key }) })
      .then(() => setThreads((ts) => ts.map((x) => x.thread_key === t.thread_key ? { ...x, unread: false } : x)))
      .catch(() => {});
  }

  async function send() {
    if (!active || (!text.trim() && !files.length)) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/marketplace/messages', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief_id: active.brief_id, talent_id: active.talent_id, body: text.trim(), attachments: files }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || '送出失敗');
      setMsgs((m) => [...m, j.message]); setText(''); setFiles([]);
      toast.success('已送出(自動寄信/Telegram 通知對方)');
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : '送出失敗'); } finally { setBusy(false); }
  }

  return (
    <div className="p-6 lg:p-10 text-gray-900">
      <h1 className="text-xl font-semibold mb-1">訊息</h1>
      <p className="text-gray-500 text-sm mb-4">全部對話一頁看完:配音員或客戶回了,這裡會亮紅點,也會寄信通知你。點開即回,回覆會自動通知對方。</p>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 max-w-6xl">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden self-start">
          {!loaded ? <p className="p-4 text-sm text-gray-500">載入中…</p>
            : threads.length === 0 ? <p className="p-4 text-sm text-gray-500">還沒有任何對話。從案件的 💬 或製作管理的訂單卡發第一則即可。</p>
            : threads.map((t) => (
              <button key={t.thread_key} onClick={() => open(t)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 ${active?.thread_key === t.thread_key ? 'bg-green-50' : ''}`}>
                <div className="flex items-center gap-2">
                  {t.unread && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                  <span className="font-medium text-sm truncate">{t.talent_name}</span>
                  <span className="ml-auto text-[11px] text-gray-400 shrink-0">{fmtT(t.last_at)}</span>
                </div>
                <p className="text-[11px] text-gray-500 truncate mt-0.5">{t.brief_title}</p>
                <p className={`text-xs truncate mt-0.5 ${t.unread ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                  {t.last_sender === 'admin' ? '我們:' : ''}{t.last_body}
                </p>
              </button>
            ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col min-h-[420px]">
          {!active ? <p className="text-sm text-gray-400 m-auto">← 選一串對話</p> : (
            <>
              <p className="font-semibold text-sm mb-2">{active.talent_name} · {active.brief_title}</p>
              <div className="flex-1 overflow-auto space-y-2 border border-gray-100 rounded-lg p-3 bg-gray-50">
                {msgs.length === 0 && <p className="text-xs text-gray-400">載入中…</p>}
                {msgs.map((m) => (
                  <div key={m.id} className={`text-sm max-w-[85%] rounded-lg px-3 py-1.5 ${m.sender_type === 'admin' ? 'ml-auto bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    {(m.attachments || []).length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        {(m.attachments || []).map((a, i) => /\.(png|jpe?g|gif|webp)(\?|$)/i.test(a.url)
                          ? <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={a.url} alt={a.name} className="max-h-32 rounded-lg border border-white/20" /></a>
                          : <a key={i} href={`${a.url}${a.url.includes('?') ? '&' : '?'}download=${encodeURIComponent(a.name)}`} className={`block text-xs underline ${m.sender_type === 'admin' ? 'text-sky-300' : 'text-sky-600'}`}>⇩ {a.name}</a>)}
                      </div>
                    )}
                    <p className="text-[10px] mt-0.5 text-gray-400">{m.sender_type === 'admin' ? 'Onyx' : (m.sender_name || '對方')} · {fmtT(m.created_at)}</p>
                  </div>
                ))}
              </div>
              {files.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {files.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-xs bg-gray-100 border border-gray-300 rounded-full px-2.5 py-1">
                      {f.name}<button onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">✕</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-2 flex gap-2">
                <label className={`self-end text-xs rounded-lg px-3 py-2.5 cursor-pointer border border-gray-300 whitespace-nowrap ${uploading ? 'bg-gray-100 text-gray-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                  {uploading ? '上傳中…' : '+ 附件'}
                  <input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ''; }} />
                </label>
                <textarea className={`${input} min-h-[44px] resize-y flex-1`} value={text} placeholder="輸入訊息…(送出會自動寄信/Telegram 通知對方)" onChange={(e) => setText(e.target.value)} />
                <button onClick={send} disabled={busy || (!text.trim() && !files.length)} className="text-sm bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white rounded-lg px-4 self-end py-2">{busy ? '送出中…' : '送出'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
