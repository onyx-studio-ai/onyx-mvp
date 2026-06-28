'use client';

/*
  Admin marketplace — Onyx mediates briefs + quotes (managed model).
  Lists briefs with their quotes; lets Onyx shortlist / accept / reject quotes
  and move briefs through their states. Accepting a quote awards the brief.
  Internal tool (admin-cookie auth). Light theme to match the admin shell.
*/

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import { caseCode } from '@/lib/casting';
import JSZip from 'jszip';
import { AdminHeader, AdminStats } from '@/components/admin/list-ui';

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
  rate_note: string | null;
  roles: { name?: string }[] | null;
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
  role_name?: string | null;
  sample_url?: string | null;
  delivery_url?: string | null;
  delivery_uploaded_at?: string | null;
  talents?: { name: string; email: string } | null;
};

const BRIEF_NEXT: Record<string, string[]> = {
  open: ['reviewing', 'closed', 'cancelled'],
  reviewing: ['open', 'closed', 'cancelled'],
  awarded: ['closed'],
  closed: ['reviewing', 'open'],     // 弄回來:送回待審(客戶案=回客戶請求收件匣)或直接重開徵選
  cancelled: ['reviewing', 'open'],
};
// friendly labels for the status-transition buttons (raw status reads cryptic)
const STATUS_ACTION: Record<string, string> = {
  reviewing: '待審', open: '開放徵選', closed: '關閉', cancelled: '取消',
};

export default function AdminMarketplace() {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [phase, setPhase] = useState<'loading' | 'unauth' | 'ready'>('loading');
  const [unavailable, setUnavailable] = useState(false);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notifying, setNotifying] = useState<string | null>(null);
  const [editRate, setEditRate] = useState<{ id: string; val: string } | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const isOpen = (id: string) => openIds.has(id);
  const toggleOpen = (id: string) => setOpenIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/marketplace', { credentials: 'include' });
    if (res.status === 401) return setPhase('unauth');
    const j = await res.json().catch(() => ({}));
    // Hide ONLY un-actioned CLIENT requests (they live in 客戶請求 /admin/requests).
    // Onyx-posted cases (client_email = casting@) always show here, any status.
    setBriefs((j.briefs || []).filter((b: Brief) => !(b.status === 'reviewing' && b.client_email && b.client_email !== 'casting@onyxstudios.ai')));
    setQuotes(j.quotes || []);
    setUnavailable(!!j.unavailable);
    setPhase('ready');
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // open the first case by default; respect the user's toggles after that
  useEffect(() => { if (briefs.length) setOpenIds((s) => (s.size ? s : new Set([briefs[0].id]))); }, [briefs]);

  async function notifyCasting(b: Brief) {
    setNotifying(b.id);
    try {
      const pre = await fetch('/api/admin/casting', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id: b.id, send: false }),
      }).then((r) => r.json());
      const n = pre.notified || 0;
      if (!n) { toast.error('沒有符合語言的配音員可通知(檢查案件語言是否中文/英文)。'); return; }
      if (!confirm(`「${b.title || caseCode(b)}」符合 ${n} 位配音員。\n確定現在寄出試音通知信?`)) return;
      const res = await fetch('/api/admin/casting', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id: b.id, send: true }),
      }).then((r) => r.json());
      if (res.sent) toast.success(`已寄出 ${res.notified} 封通知信`); else toast.error('寄送失敗,請稍後再試');
    } catch { toast.error('寄送失敗,請稍後再試'); } finally { setNotifying(null); }
  }

  async function toOrder(b: Brief) {
    const isPlatform = !b.client_email || b.client_email === 'casting@onyxstudios.ai';
    // Platform-posted cases have no client email on file — ask for the end client's
    // email so the production order has a billing/delivery contact.
    let clientEmail = '';
    if (isPlatform) {
      clientEmail = (window.prompt('平台發案：請輸入這筆訂單的客戶 email（用於帳務與交付通知）：') || '').trim();
      if (!clientEmail) return;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) { toast.error('email 格式不正確'); return; }
    }
    if (!confirm(`將「${b.title || caseCode(b)}」轉成製作單?\n會進入「訂單」系統管理製作與交付,此試音案隨之結案。`)) return;
    try {
      const res = await fetch('/api/admin/casting/to-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ briefId: b.id, clientEmail: clientEmail || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(j.error || '建單失敗'); return; }
      toast.success(`已建立製作單 ${j.order_number} —— 請到「訂單」管理製作與交付`);
      load();
    } catch { toast.error('建單失敗,請稍後再試'); }
  }

  // Duplicate a case as a fresh reviewing draft (client re-scope → re-audition).
  async function cloneCase(b: Brief) {
    if (!confirm(`複製「${b.title || caseCode(b)}」成一個新案?\n新案會回到「客戶請求」待審(可重新編輯再發);原案與原試音都保留不動。`)) return;
    try {
      const res = await fetch('/api/admin/casting/clone', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ briefId: b.id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(j.error || '複製失敗'); return; }
      toast.success(j.toInbox ? '已複製 —— 新案在「客戶請求」待審,可重新編輯再發' : '已複製 —— 新案在此頁待審(平台案)');
      load();
    } catch { toast.error('複製失敗,請稍後再試'); }
  }

  async function saveRate(id: string, val: string) {
    await fetch('/api/admin/marketplace', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ kind: 'brief', id, rate_note: val.trim() }),
    }).catch(() => {});
    setEditRate(null);
    load();
  }

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

  const q = search.trim().toLowerCase();
  const filtered = !q ? briefs : briefs.filter((b) =>
    [b.title, b.client_name, b.client_email, b.brief_number, caseCode(b), b.language]
      .some((v) => (v || '').toString().toLowerCase().includes(q)));

  const stats = [
    { label: '案件總數', value: briefs.length },
    { label: '徵選中', value: briefs.filter((b) => b.status === 'open').length, color: 'text-green-700' },
    { label: '已選定', value: briefs.filter((b) => b.status === 'awarded').length, color: 'text-blue-700' },
    { label: '已結束', value: briefs.filter((b) => b.status === 'closed').length, color: 'text-gray-500' },
  ];

  return (
    <div className="p-6 lg:p-8 text-gray-900">
      <AdminHeader
        title="案件 · 報價"
        subtitle="Onyx 發的試音案 + 配音員報價。客戶送來的需求請看「客戶請求」頁。點任一案展開細節。"
        action={<a href="/admin/casting/new" className="text-sm bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg px-3 py-2">+ 發案(試音案)</a>}
      />
      <AdminStats items={stats} />

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜尋案件、客戶、案號或語言…"
          className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-green-400 focus:outline-none" />
      </div>

      {unavailable && (
        <div className="mb-4 text-amber-800 text-sm bg-amber-50 border border-amber-200 rounded-lg p-3">
          ⚠️ marketplace 資料表尚未建立 —— 請先跑 migration <code>20260620120000_marketplace_briefs_quotes.sql</code>。
        </div>
      )}

      {filtered.length === 0 && !unavailable && <p className="text-gray-500 text-sm">{briefs.length === 0 ? '目前沒有案件。' : '沒有符合搜尋的案件。'}</p>}

      <div className="space-y-3">
        {filtered.map((b) => (
          <div key={b.id} className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
            {/* compact bar — always visible; click to expand the full case */}
            <button onClick={() => toggleOpen(b.id)} className="w-full text-left px-5 py-3.5 hover:bg-gray-50 transition">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className="font-mono text-xs text-gray-500">{b.kind === 'casting' ? caseCode(b) : b.brief_number}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${b.status === 'open' ? 'bg-green-100 text-green-700' : b.status === 'awarded' ? 'bg-blue-100 text-blue-700' : b.status === 'reviewing' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>{b.status}</span>
                    {b.kind === 'casting' && <span className="text-[11px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">試音案</span>}
                    {b.client_email && b.client_email !== 'casting@onyxstudios.ai' && <span className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">客戶請求</span>}
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">{b.title || b.client_name || b.client_email || '—'}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-500">
                    {b.language && <span>{b.language}</span>}
                    {b.rate_note && <span className="text-amber-700">{b.rate_note}</span>}
                    {b.kind === 'casting' && (b.roles || []).length > 0 && <span>{(b.roles || []).length} 角</span>}
                    <span>{quotesFor(b.id).length} 報價</span>
                    {(b.audition_deadline || b.deadline) && <span>截止 {b.audition_deadline || b.deadline}</span>}
                  </div>
                </div>
                <span className={`text-gray-400 text-xs pt-1 transition-transform ${isOpen(b.id) ? 'rotate-180' : ''}`}>▾</span>
              </div>
            </button>

            {isOpen(b.id) && (
            <div className="px-5 pb-5">
            {b.kind === 'casting' ? (
              <div className="mb-2">
                {b.client_email && b.client_email !== 'casting@onyxstudios.ai' && (
                  <div className="mb-1.5">
                    <p className="text-xs text-gray-600">📥 {b.client_name || '—'}{b.company ? ` · ${b.company}` : ''} · {b.client_email}{b.budget ? ` · 客戶預算 ${b.budget_type || ''} ${b.budget}` : ''}</p>
                    {b.status === 'reviewing' && (
                      <a href={`/admin/casting/new?from=${b.id}`} className="inline-block mt-1.5 text-xs bg-amber-500 hover:bg-amber-400 text-white font-semibold rounded-lg px-3 py-1.5">
                        ✏️ 補角色 + 定價並發佈 →
                      </a>
                    )}
                  </div>
                )}
                {/* shareable open link — paste into WeChat/LINE; anyone joins & auditions without registering */}
                <div className="flex items-center gap-2">
                  <input readOnly value={`${SITE}/casting/join/${b.id}`} onFocus={(e) => e.target.select()}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 font-mono" />
                  <a href={`/casting/preview/${b.id}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 rounded px-2.5 py-1 whitespace-nowrap" title="以配音員視角預覽前台(唯讀)">👁 預覽前台</a>
                  <button onClick={() => { navigator.clipboard?.writeText(`${SITE}/casting/join/${b.id}`); setCopiedId(b.id); setTimeout(() => setCopiedId(null), 1500); }}
                    className="text-xs bg-gray-900 hover:bg-gray-700 text-white rounded px-2.5 py-1 whitespace-nowrap">{copiedId === b.id ? '已複製 ✓' : '🔗 複製試音連結'}</button>
                  {b.status === 'open' && (
                    <button onClick={() => notifyCasting(b)} disabled={notifying === b.id}
                      className="text-xs bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded px-2.5 py-1 whitespace-nowrap" title="寄試音通知信給符合語言的配音員">
                      {notifying === b.id ? '處理中…' : '📣 通知配音員'}
                    </button>
                  )}
                  {quotesFor(b.id).some((q) => q.sample_url) && (
                    <DownloadAllAuditions quotes={quotesFor(b.id)} label={b.kind === 'casting' ? caseCode(b) : b.brief_number} />
                  )}
                </div>
                {/* inline 報酬 edit + full case edit */}
                <div className="flex items-center gap-2 mt-2 text-sm">
                  <span className="text-gray-500 text-xs">報酬</span>
                  {editRate?.id === b.id ? (
                    <>
                      <input value={editRate.val} onChange={(e) => setEditRate({ id: b.id, val: e.target.value })} autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') saveRate(b.id, editRate.val); if (e.key === 'Escape') setEditRate(null); }}
                        placeholder="例:NT$150 / 句" className="bg-white border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 w-44" />
                      <button onClick={() => saveRate(b.id, editRate.val)} className="text-xs bg-green-600 hover:bg-green-500 text-white rounded px-2.5 py-1">儲存</button>
                      <button onClick={() => setEditRate(null)} className="text-xs text-gray-500 hover:text-gray-700">取消</button>
                    </>
                  ) : (
                    <>
                      <span className="text-gray-900 font-medium">{b.rate_note || '—'}</span>
                      <button onClick={() => setEditRate({ id: b.id, val: b.rate_note || '' })} className="text-xs text-blue-600 hover:underline">編輯</button>
                      <a href={`/admin/casting/${b.id}/edit`} className="text-xs bg-gray-900 hover:bg-gray-700 text-white rounded px-2.5 py-1 ml-auto">✏️ 編輯整個案件(角色/台詞)</a>
                    </>
                  )}
                </div>
              </div>
            ) : (
              b.company && <p className="text-sm text-gray-700 mb-1">{b.company}</p>
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

            {/* awarded → create the production order. Client cases bill the client on
                file; platform cases prompt for the end-client email at conversion. */}
            {b.status === 'awarded' && (
              <div className="mb-3 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <span className="text-xs text-blue-800">
                  已採用配音員 —— 接著建立製作單,進訂單系統管理錄製與交付。
                  {(!b.client_email || b.client_email === 'casting@onyxstudios.ai') && '(平台發案:建單時會請你輸入客戶 email)'}
                </span>
                <button onClick={() => toOrder(b)} className="ml-auto text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg px-3 py-1.5 whitespace-nowrap">→ 建立製作單</button>
              </div>
            )}

            {/* brief status controls */}
            <div className="flex flex-wrap gap-2 mb-3">
              {(BRIEF_NEXT[b.status] || [])
                // 防矛盾:已有試音的案不能「送回待審」(待審=還沒成案,試音會變孤兒)。
                // 這種案要嘛重新開放(試音都在)、要嘛關閉,或之後「複製成新案」重發。
                .filter((s) => !(s === 'reviewing' && quotesFor(b.id).length > 0))
                .map((s) => (
                  <button key={s} onClick={() => patch('brief', b.id, s)} className="text-xs bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 rounded-lg px-2.5 py-1 transition">
                    → {STATUS_ACTION[s] || s}
                  </button>
                ))}
              <button onClick={() => cloneCase(b)} className="text-xs bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 rounded-lg px-2.5 py-1 transition" title="複製成新案,回到客戶請求重新編輯再發(原案+試音保留)">⧉ 複製案子</button>
            </div>

            {/* quotes */}
            <div className="border-t border-gray-200 pt-3 space-y-2">
              {quotesFor(b.id).length === 0 && <p className="text-xs text-gray-400">尚無報價</p>}
              {quotesFor(b.id).map((q) => {
                const tkey = `${b.id}:${q.talent_id}`;
                return (
                  <div key={q.id}>
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <span className="text-gray-800">{q.talents?.name || '配音員'}</span>
                        {q.role_name && <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{q.role_name}</span>}
                        {q.commission_rate > 0 ? (
                          <span className="text-gray-500 ml-2">
                            客戶付 {q.currency} {q.gross_amount} · 配音員淨得 {q.currency} {q.net_amount}{' '}
                            <span className="text-gray-400">(抽 {Math.round(q.commission_rate * 100)}%)</span>
                          </span>
                        ) : (
                          <span className="text-gray-500 ml-2">報價 {q.currency} {q.gross_amount} <span className="text-gray-400">(平台不抽成)</span></span>
                        )}
                        {q.message && <p className="text-xs text-gray-500 truncate">{q.message}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => setOpenThread(openThread === tkey ? null : tkey)} className="text-xs bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded px-2 py-0.5" title="訊息">💬</button>
                        <span className={`text-xs ${q.status === 'accepted' ? 'text-blue-700' : q.status === 'rejected' || q.status === 'withdrawn' ? 'text-gray-400' : 'text-green-700'}`}>{q.status}</span>
                        {['submitted', 'shortlisted'].includes(q.status) && (
                          <>
                            <button onClick={() => patch('quote', q.id, 'accepted')} className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded px-2 py-0.5">採用</button>
                            <button onClick={() => patch('quote', q.id, 'rejected')} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded px-2 py-0.5">婉拒</button>
                          </>
                        )}
                      </div>
                    </div>
                    {q.sample_url
                      ? <audio controls src={q.sample_url} className="w-full h-9 mt-2" />
                      : <p className="text-xs text-gray-400 mt-1">(無試音音檔)</p>}
                    {q.delivery_url && (
                      <div className="mt-2 flex items-center gap-2 text-xs bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5">
                        <span className="text-blue-700 font-medium">✓ 完成交付</span>
                        <a href={q.delivery_url} target="_blank" rel="noreferrer" download className="text-blue-600 underline">下載</a>
                        {q.delivery_uploaded_at && <span className="text-gray-400">{new Date(q.delivery_uploaded_at).toLocaleString('zh-TW')}</span>}
                      </div>
                    )}
                    </div>
                    {openThread === tkey && <AdminThread briefId={b.id} talentId={q.talent_id} />}
                  </div>
                );
              })}
            </div>
            </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Zip every audition IN THE BROWSER (the files are public URLs), with live X/N
// progress. Avoids the server-side zip endpoint that 504'd on many files, and —
// unlike the old plain <a> link — actually shows whether it's working / failed.
function DownloadAllAuditions({ quotes, label }: { quotes: Quote[]; label: string }) {
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState({ done: 0, total: 0, fail: 0 });
  const items = quotes.filter((q) => q.sample_url);
  const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '').trim();
  const run = async () => {
    if (busy || !items.length) return;
    setBusy(true); setProg({ done: 0, total: items.length, fail: 0 });
    const zip = new JSZip();
    let done = 0, fail = 0; const used: Record<string, number> = {};
    for (const q of items) {
      try {
        const res = await fetch(q.sample_url as string);
        if (!res.ok) throw new Error('fetch failed');
        const blob = await res.blob();
        const ext = ((q.sample_url as string).split('?')[0].split('.').pop() || 'mp3').toLowerCase().slice(0, 4);
        let base = `${clean(q.role_name || '試音')}_${clean(q.talents?.name || '配音員')}`;
        used[base] = (used[base] || 0) + 1;
        if (used[base] > 1) base += `_${used[base]}`;
        zip.file(`${base}.${ext}`, blob);
      } catch { fail++; }
      done++; setProg({ done, total: items.length, fail });
    }
    try {
      const out = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(out);
      const a = document.createElement('a'); a.href = url; a.download = `${clean(label) || 'casting'}_試音.zip`; a.click();
      URL.revokeObjectURL(url);
      if (fail) alert(`完成,但有 ${fail} 個檔下載失敗(可能連結失效),其餘已打包。`);
    } catch { alert('打包失敗,請重試。'); }
    setBusy(false);
  };
  return (
    <button onClick={run} disabled={busy} className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded px-2.5 py-1 whitespace-nowrap" title="逐檔在瀏覽器打包下載(檔名:角色_配音員)">
      {busy ? `下載中 ${prog.done}/${prog.total}${prog.fail ? ` · ${prog.fail} 失敗` : ''}…` : '⬇️ 下載全部試音'}
    </button>
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
