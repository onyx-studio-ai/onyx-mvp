'use client';

/*
  Admin marketplace — Onyx mediates briefs + quotes (managed model).
  Lists briefs with their quotes; lets Onyx shortlist / accept / reject quotes
  and move briefs through their states. Accepting a quote awards the brief.
  Internal tool (admin-cookie auth). Light theme to match the admin shell.
*/

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import { caseCode, auditionDeadlinePassed } from '@/lib/casting';
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
  more_demos_requested_at?: string | null;
  more_demos_note?: string | null;
  extra_samples?: { url: string; label?: string | null; created_at?: string }[] | null;
  talents?: { name: string; email: string } | null;
};

const BRIEF_NEXT: Record<string, string[]> = {
  open: ['reviewing', 'closed', 'cancelled'],
  reviewing: ['open', 'closed', 'cancelled'],
  awarded: ['closed'],
  closed: ['reviewing', 'open'],     // 弄回來:送回待審(客戶案=回客戶請求收件匣)或直接重開徵選
  cancelled: ['reviewing', 'open'],
};
// friendly labels for the status-transition buttons (raw status reads cryptic).
// 顯示文字走 i18n:label 在元件內用 t() 建 map,只換文字不動 raw status key。

export default function AdminMarketplace() {
  const t = useTranslations('admin.marketplace');
  // raw status → 友善按鈕文字(只換顯示,狀態 key 不動)
  const STATUS_ACTION: Record<string, string> = {
    reviewing: t('actionReviewing'), open: t('actionOpen'), closed: t('actionClosed'), cancelled: t('actionCancelled'),
  };
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
  // 指定邀請(可含未上線):對已發佈案件按名字點名,系統用存的 email 免註冊發。
  const [directory, setDirectory] = useState<{ id: string; name: string; email: string; active: boolean }[]>([]);
  const [pinFor, setPinFor] = useState<Brief | null>(null);
  const [pinPicked, setPinPicked] = useState<{ email: string; name: string; active: boolean }[]>([]);
  const [pinQ, setPinQ] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
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

  // 全通訊錄(含未上線,只要有 email)供「指定邀請」按名字搜。
  useEffect(() => {
    fetch('/api/admin/talents', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((all) => setDirectory((Array.isArray(all) ? all : [])
        .filter((t: { email?: string }) => !!t.email)
        .map((t: { id: string; name?: string; email?: string; is_active?: boolean; type?: string }) => ({ id: t.id, name: t.name || '(未命名)', email: String(t.email), active: !!t.is_active && ['voice_actor', 'VO', 'Singer'].includes(t.type || '') }))))
      .catch(() => {});
  }, []);

  async function sendPinInvites() {
    if (!pinFor || !pinPicked.length) return;
    setPinBusy(true);
    try {
      const res = await fetch('/api/admin/casting', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id: pinFor.id, pin_invite_emails: pinPicked.map((p) => p.email), send: true }),
      }).then((r) => r.json());
      if (res.sent) { toast.success(`已寄試音邀請給 ${res.notified} 位`); setPinFor(null); setPinPicked([]); setPinQ(''); }
      else toast.error('寄送失敗');
    } catch { toast.error('寄送失敗'); } finally { setPinBusy(false); }
  }

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
      if (!n) { toast.error(t('notifyNoMatch')); return; }
      if (!confirm(t('notifyConfirm', { name: b.title || caseCode(b), count: n }))) return;
      const res = await fetch('/api/admin/casting', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id: b.id, send: true }),
      }).then((r) => r.json());
      if (res.sent) toast.success(t('notifySent', { count: res.notified })); else toast.error(t('notifyFail'));
    } catch { toast.error(t('notifyFail')); } finally { setNotifying(null); }
  }

  async function toOrder(b: Brief) {
    const isPlatform = !b.client_email || b.client_email === 'casting@onyxstudios.ai';
    // Platform-posted cases have no client email on file — ask for the end client's
    // email so the production order has a billing/delivery contact.
    let clientEmail = '';
    if (isPlatform) {
      clientEmail = (window.prompt(t('toOrderPrompt')) || '').trim();
      if (!clientEmail) return;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) { toast.error(t('emailInvalid')); return; }
    }
    if (!confirm(t('toOrderConfirm', { name: b.title || caseCode(b) }))) return;
    try {
      const res = await fetch('/api/admin/casting/to-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ briefId: b.id, clientEmail: clientEmail || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(j.error || t('toOrderFail')); return; }
      toast.success(j.count > 1 ? t('toOrderSuccessMulti', { count: j.count }) : t('toOrderSuccess', { orderNumber: j.order_number }));
      load();
    } catch { toast.error(t('toOrderFailRetry')); }
  }

  // Duplicate a case as a fresh reviewing draft (client re-scope → re-audition).
  async function cloneCase(b: Brief) {
    if (!confirm(t('cloneConfirm', { name: b.title || caseCode(b) }))) return;
    try {
      const res = await fetch('/api/admin/casting/clone', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ briefId: b.id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(j.error || t('cloneFail')); return; }
      toast.success(j.toInbox ? t('cloneSuccessInbox') : t('cloneSuccessPlatform'));
      load();
    } catch { toast.error(t('cloneFailRetry')); }
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

  // Ask this auditioner to upload MORE demos (other tones / characters) — notifies
  // the talent; they upload under 「追加 demo」 in their opportunities page.
  async function requestMoreDemos(quoteId: string) {
    const note = window.prompt(t('moreDemosPrompt'), '');
    if (note === null) return;
    const res = await fetch('/api/admin/marketplace/request-demos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ quote_id: quoteId, note }),
    });
    if (res.ok) { alert(t('moreDemosNotified')); load(); }
    else { const j = await res.json().catch(() => ({})); alert(j.error || t('genericFail')); }
  }

  if (phase === 'loading') return <div className="p-8 text-gray-500 text-sm">{t('loading')}</div>;
  if (phase === 'unauth') return <div className="p-8 text-gray-500 text-sm">{t('unauth')}</div>;

  const quotesFor = (briefId: string) => quotes.filter((q) => q.brief_id === briefId);

  const q = search.trim().toLowerCase();
  const filtered = !q ? briefs : briefs.filter((b) =>
    [b.title, b.client_name, b.client_email, b.brief_number, caseCode(b), b.language]
      .some((v) => (v || '').toString().toLowerCase().includes(q)));

  const stats = [
    { label: t('statTotal'), value: briefs.length },
    { label: t('statOpen'), value: briefs.filter((b) => b.status === 'open').length, color: 'text-green-700' },
    { label: t('statAwarded'), value: briefs.filter((b) => b.status === 'awarded').length, color: 'text-blue-700' },
    { label: t('statClosed'), value: briefs.filter((b) => b.status === 'closed').length, color: 'text-gray-500' },
  ];

  return (
    <div className="p-6 lg:p-8 text-gray-900">
      <AdminHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={<a href="/admin/casting/new" className="text-sm bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg px-3 py-2">{t('newCasting')}</a>}
      />
      <AdminStats items={stats} />

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('searchPlaceholder')}
          className="w-full bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-green-400 focus:outline-none" />
      </div>

      {unavailable && (
        <div className="mb-4 text-amber-800 text-sm bg-amber-50 border border-amber-200 rounded-lg p-3">
          {t('unavailablePrefix')}<code>20260620120000_marketplace_briefs_quotes.sql</code>{t('unavailableSuffix')}
        </div>
      )}

      {filtered.length === 0 && !unavailable && <p className="text-gray-500 text-sm">{briefs.length === 0 ? t('emptyNoCases') : t('emptyNoMatch')}</p>}

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
                    {b.kind === 'casting' && <span className="text-[11px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{t('tagCasting')}</span>}
                    {b.client_email && b.client_email !== 'casting@onyxstudios.ai' && <span className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">{t('tagClientRequest')}</span>}
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">{b.title || b.client_name || b.client_email || t('dash')}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-500">
                    {b.language && <span>{b.language}</span>}
                    {b.rate_note && <span className="text-amber-700">{b.rate_note}</span>}
                    {b.kind === 'casting' && (b.roles || []).length > 0 && <span>{t('rolesCount', { count: (b.roles || []).length })}</span>}
                    <span>{t('quotesCount', { count: quotesFor(b.id).length })}</span>
                    {(b.audition_deadline || b.deadline) && <span>{t('deadlineLabel')} {b.audition_deadline || b.deadline}</span>}
                    {b.status === 'open' && auditionDeadlinePassed(b) && <span className="text-red-600 font-medium">{t('auditionEnded')}</span>}
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
                    <p className="text-xs text-gray-600">📥 {b.client_name || t('dash')}{b.company ? ` · ${b.company}` : ''} · {b.client_email}{b.budget ? ` · ${t('clientBudget')} ${b.budget_type || ''} ${b.budget}` : ''}</p>
                    {b.status === 'reviewing' && (
                      <a href={`/admin/casting/new?from=${b.id}`} className="inline-block mt-1.5 text-xs bg-amber-500 hover:bg-amber-400 text-white font-semibold rounded-lg px-3 py-1.5">
                        {t('addRolesPublish')}
                      </a>
                    )}
                  </div>
                )}
                {/* shareable open link — paste into WeChat/LINE; anyone joins & auditions without registering */}
                <div className="flex items-center gap-2">
                  <input readOnly value={`${SITE}/casting/join/${b.id}`} onFocus={(e) => e.target.select()}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 font-mono" />
                  <a href={`/casting/preview/${b.id}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 rounded px-2.5 py-1 whitespace-nowrap" title={t('previewFrontTitle')}>{t('previewFront')}</a>
                  <button onClick={() => { navigator.clipboard?.writeText(`${SITE}/casting/join/${b.id}`); setCopiedId(b.id); setTimeout(() => setCopiedId(null), 1500); }}
                    className="text-xs bg-gray-900 hover:bg-gray-700 text-white rounded px-2.5 py-1 whitespace-nowrap">{copiedId === b.id ? t('copied') : t('copyCastingLink')}</button>
                  {b.status === 'open' && (
                    <button onClick={() => notifyCasting(b)} disabled={notifying === b.id}
                      className="text-xs bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white rounded px-2.5 py-1 whitespace-nowrap" title={t('notifyTalentTitle')}>
                      {notifying === b.id ? t('processing') : t('notifyTalent')}
                    </button>
                  )}
                  {b.status === 'open' && b.kind === 'casting' && (
                    <button onClick={() => { setPinFor(b); setPinPicked([]); setPinQ(''); }}
                      className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 rounded px-2.5 py-1 whitespace-nowrap" title="按名字點名邀請(可含未上線)">
                      指定邀請
                    </button>
                  )}
                  {b.kind === 'casting' && (
                    <a href={`/admin/casting/${b.id}/production`}
                      className="text-xs bg-violet-600 hover:bg-violet-500 text-white rounded px-2.5 py-1 whitespace-nowrap" title="角色製作單:台詞匯入 / 參考音 / 調價">
                      製作管理
                    </a>
                  )}
                  {quotesFor(b.id).some((q) => q.sample_url) && (
                    <DownloadAllAuditions briefId={b.id} quotes={quotesFor(b.id)} label={b.kind === 'casting' ? caseCode(b) : b.brief_number} />
                  )}
                </div>
                {/* inline 報酬 edit + full case edit */}
                <div className="flex items-center gap-2 mt-2 text-sm">
                  <span className="text-gray-500 text-xs">{t('rateLabel')}</span>
                  {editRate?.id === b.id ? (
                    <>
                      <input value={editRate.val} onChange={(e) => setEditRate({ id: b.id, val: e.target.value })} autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') saveRate(b.id, editRate.val); if (e.key === 'Escape') setEditRate(null); }}
                        placeholder={t('ratePlaceholder')} className="bg-white border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 w-44" />
                      <button onClick={() => saveRate(b.id, editRate.val)} className="text-xs bg-green-600 hover:bg-green-500 text-white rounded px-2.5 py-1">{t('save')}</button>
                      <button onClick={() => setEditRate(null)} className="text-xs text-gray-500 hover:text-gray-700">{t('cancel')}</button>
                    </>
                  ) : (
                    <>
                      <span className="text-gray-900 font-medium">{b.rate_note || t('dash')}</span>
                      <button onClick={() => setEditRate({ id: b.id, val: b.rate_note || '' })} className="text-xs text-blue-600 hover:underline">{t('edit')}</button>
                      <a href={`/admin/casting/${b.id}/edit`} className="text-xs bg-gray-900 hover:bg-gray-700 text-white rounded px-2.5 py-1 ml-auto">{t('editWholeCase')}</a>
                    </>
                  )}
                </div>
              </div>
            ) : (
              b.company && <p className="text-sm text-gray-700 mb-1">{b.company}</p>
            )}
            <div className="flex flex-wrap gap-1.5 my-2">
              {b.content_type && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">{b.content_type}</span>}
              {b.has_singing && <span className="text-xs bg-pink-100 text-pink-800 px-2 py-0.5 rounded-full">{t('flagHasSinging')}</span>}
              {b.wants_live_session && <span className="text-xs bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full">{t('flagLiveRecording')}{b.live_session_tool ? ` · ${b.live_session_tool}` : ''}</span>}
              {b.wants_director && <span className="text-xs bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full">{t('flagDirector')}</span>}
              {!b.content_type && (b.categories || []).map((c, i) => (
                <span key={i} className="text-xs bg-gray-100 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{c}</span>
              ))}
              {b.language && <span className="text-xs text-green-700">{b.language}</span>}
            </div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap mb-2">{b.brief}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
              {b.media_scope && <span>{t('metaMedia')} {b.media_scope}</span>}
              {b.territory && <span>{t('metaTerritory')} {b.territory}</span>}
              {b.license_term && <span>{t('metaLicense')} {b.license_term}</span>}
              {b.length && <span>{t('metaLength')} {b.length}</span>}
              {b.budget && <span>{t('metaBudget')} {b.budget_type ? `${b.budget_type} ` : ''}{b.budget}</span>}
              {b.audition_deadline && <span>{t('metaAuditionDeadline')} {b.audition_deadline}</span>}
              {b.deadline && <span>{t('metaDeliveryDeadline')} {b.deadline}</span>}
              {b.script_status && <span>{t('metaScript')} {b.script_status}</span>}
            </div>

            {/* awarded → create the production order. Client cases bill the client on
                file; platform cases prompt for the end-client email at conversion. */}
            {b.status === 'awarded' && (
              <div className="mb-3 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <span className="text-xs text-blue-800">
                  {t('awardedNote')}
                  {(!b.client_email || b.client_email === 'casting@onyxstudios.ai') && t('awardedPlatformHint')}
                </span>
                <button onClick={() => toOrder(b)} className="ml-auto text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg px-3 py-1.5 whitespace-nowrap">{t('createOrder')}</button>
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
              <button onClick={() => cloneCase(b)} className="text-xs bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 rounded-lg px-2.5 py-1 transition" title={t('cloneCaseTitle')}>{t('cloneCase')}</button>
            </div>

            {/* quotes */}
            <div className="border-t border-gray-200 pt-3 space-y-2">
              {quotesFor(b.id).length === 0 && <p className="text-xs text-gray-400">{t('noQuotes')}</p>}
              {quotesFor(b.id).map((q) => {
                const tkey = `${b.id}:${q.talent_id}`;
                return (
                  <div key={q.id}>
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <span className="text-gray-800">{q.talents?.name || t('talentFallback')}</span>
                        {q.role_name && <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{q.role_name}</span>}
                        {q.commission_rate > 0 ? (
                          <span className="text-gray-500 ml-2">
                            {t('quoteClientPays', { currency: q.currency, gross: q.gross_amount })} · {t('quoteTalentNets', { currency: q.currency, net: q.net_amount })}{' '}
                            <span className="text-gray-400">{t('quoteCommission', { pct: Math.round(q.commission_rate * 100) })}</span>
                          </span>
                        ) : (
                          <span className="text-gray-500 ml-2">{t('quoteAmount', { currency: q.currency, gross: q.gross_amount })} <span className="text-gray-400">{t('quoteNoCommission')}</span></span>
                        )}
                        {q.message && <p className="text-xs text-gray-500 truncate">{q.message}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => setOpenThread(openThread === tkey ? null : tkey)} className="text-xs bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded px-2 py-0.5" title={t('messageTitle')}>💬</button>
                        <span className={`text-xs ${q.status === 'accepted' ? 'text-blue-700' : q.status === 'rejected' || q.status === 'withdrawn' ? 'text-gray-400' : 'text-green-700'}`}>{q.status}</span>
                        {['submitted', 'shortlisted'].includes(q.status) && (
                          <>
                            <button onClick={() => patch('quote', q.id, 'accepted')} className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded px-2 py-0.5">{t('accept')}</button>
                            <button onClick={() => patch('quote', q.id, 'rejected')} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded px-2 py-0.5">{t('decline')}</button>
                          </>
                        )}
                      </div>
                    </div>
                    {q.sample_url
                      ? <audio controls src={q.sample_url} className="w-full h-9 mt-2" />
                      : <p className="text-xs text-gray-400 mt-1">{t('noSampleAudio')}</p>}

                    {/* 追加 demo:請這位再多提供 demo(其他語氣/角色)+ 已上傳的追加 demo(後台下載乾淨檔) */}
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <button onClick={() => requestMoreDemos(q.id)} className="text-xs bg-violet-100 hover:bg-violet-200 text-violet-700 rounded px-2 py-0.5" title={t('moreDemosBtnTitle')}>{t('moreDemosBtn')}</button>
                      {q.more_demos_requested_at && !((q.extra_samples || []).length) && (
                        <span className="text-xs text-amber-600" title={q.more_demos_note || ''}>{t('moreDemosPending')}</span>
                      )}
                      {q.more_demos_requested_at && ((q.extra_samples || []).length) > 0 && (
                        <span className="text-xs text-violet-700" title={q.more_demos_note || ''}>{t('moreDemosReceived', { count: (q.extra_samples || []).length })}</span>
                      )}
                    </div>
                    {(q.extra_samples || []).length > 0 && (
                      <div className="mt-2 space-y-1.5 rounded-lg bg-violet-50 border border-violet-200 px-2.5 py-2">
                        <p className="text-xs font-medium text-violet-700">{t('extraDemosTitle', { count: (q.extra_samples || []).length })}</p>
                        {(q.extra_samples || []).map((s, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <audio controls src={s.url} className="h-8 flex-1 min-w-0" />
                            <a href={s.url} target="_blank" rel="noreferrer" download className="text-xs text-violet-700 underline whitespace-nowrap">{t('download')}</a>
                          </div>
                        ))}
                      </div>
                    )}
                    {q.delivery_url && (
                      <div className="mt-2 flex items-center gap-2 text-xs bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5">
                        <span className="text-blue-700 font-medium">{t('deliveryComplete')}</span>
                        <a href={q.delivery_url} target="_blank" rel="noreferrer" download className="text-blue-600 underline">{t('download')}</a>
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

      {/* 指定邀請 modal —— 按名字點名(含未上線),系統用存的 email 免註冊發試音邀請 */}
      {pinFor && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setPinFor(null)}>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-gray-900 truncate">指定邀請 · {pinFor.title || caseCode(pinFor)}</h3>
              <button onClick={() => setPinFor(null)} className="text-gray-400 hover:text-gray-700 flex-none ml-2" aria-label="關閉">✕</button>
            </div>
            <p className="text-xs text-gray-500 mb-3">打名字搜任何已核准的配音員(含未上線),點一下加入。按「寄邀請」→ 系統自動用他存的 email 寄免註冊試音連結,你不用碰 email。</p>
            {pinPicked.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {pinPicked.map((p) => (
                  <span key={p.email} className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 rounded-full pl-2.5 pr-1 py-1">
                    {p.name}{!p.active && <span className="text-[10px] text-gray-500">未上線</span>}
                    <button onClick={() => setPinPicked((s) => s.filter((x) => x.email !== p.email))} className="w-4 h-4 rounded-full hover:bg-black/10 flex items-center justify-center" aria-label="移除">✕</button>
                  </span>
                ))}
              </div>
            )}
            <input value={pinQ} onChange={(e) => setPinQ(e.target.value)} placeholder="打名字搜配音員…" autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-400" />
            {pinQ.trim() && (() => {
              const q = pinQ.trim().toLowerCase();
              const picked = new Set(pinPicked.map((p) => p.email));
              const hits = directory.filter((d) => !picked.has(d.email) && d.name.toLowerCase().includes(q)).slice(0, 20);
              return (
                <div className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {hits.length === 0 && <p className="text-xs text-gray-400 p-3">找不到「{pinQ}」</p>}
                  {hits.map((d) => (
                    <button key={d.email} onClick={() => { setPinPicked((s) => [...s, { email: d.email, name: d.name, active: d.active }]); setPinQ(''); }}
                      className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 text-gray-800">
                      <span>{d.name}</span>{!d.active && <span className="text-[10px] text-amber-600">未上線</span>}
                    </button>
                  ))}
                </div>
              );
            })()}
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setPinFor(null)} className="text-sm px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700">取消</button>
              <button onClick={sendPinInvites} disabled={pinBusy || !pinPicked.length}
                className="text-sm px-4 py-2 rounded-lg bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white font-medium">
                {pinBusy ? '寄送中…' : `寄邀請(${pinPicked.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Zip every audition IN THE BROWSER (the files are public URLs), with live X/N
// progress. Avoids the server-side zip endpoint that 504'd on many files, and —
// unlike the old plain <a> link — actually shows whether it's working / failed.
function DownloadAllAuditions({ briefId, quotes, label }: { briefId: string; quotes: Quote[]; label: string }) {
  const t = useTranslations('admin.marketplace');
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState({ done: 0, total: 0, fail: 0 });
  const storeKey = `onyx_dl_auditions_${briefId}`;
  // Remember (per case, in this browser) which audition files were already packed,
  // so Wing can grab ONLY new uploads next time instead of re-zipping all 200+.
  const [downloaded, setDownloaded] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try { return new Set(JSON.parse(window.localStorage.getItem(storeKey) || '[]') as string[]); } catch { return new Set(); }
  });
  const items = quotes.filter((q) => q.sample_url);
  const newItems = items.filter((q) => !downloaded.has(q.sample_url as string));
  const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '').trim();

  const run = async (list: Quote[], suffix: string) => {
    if (busy || !list.length) return;
    setBusy(true); setProg({ done: 0, total: list.length, fail: 0 });
    const zip = new JSZip();
    let done = 0, fail = 0; const used: Record<string, number> = {}; const got: string[] = [];
    for (const q of list) {
      try {
        const res = await fetch(q.sample_url as string);
        if (!res.ok) throw new Error('fetch failed');
        const blob = await res.blob();
        const ext = ((q.sample_url as string).split('?')[0].split('.').pop() || 'mp3').toLowerCase().slice(0, 4);
        let base = `${clean(q.role_name || t('fileAudition'))}_${clean(q.talents?.name || t('talentFallback'))}`;
        used[base] = (used[base] || 0) + 1;
        if (used[base] > 1) base += `_${used[base]}`;
        zip.file(`${base}.${ext}`, blob);
        got.push(q.sample_url as string);
      } catch { fail++; }
      done++; setProg({ done, total: list.length, fail });
    }
    try {
      const out = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(out);
      const a = document.createElement('a'); a.href = url; a.download = `${clean(label) || 'casting'}_${t('fileAudition')}${suffix}.zip`; a.click();
      URL.revokeObjectURL(url);
      const next = new Set(downloaded); got.forEach((u) => next.add(u)); setDownloaded(next);
      try { window.localStorage.setItem(storeKey, JSON.stringify([...next])); } catch { /* quota / private mode */ }
      if (fail) alert(t('zipPartialFail', { count: fail }));
    } catch { alert(t('zipFail')); }
    setBusy(false);
  };

  if (busy) {
    return <button disabled className="text-xs bg-blue-600 disabled:opacity-60 text-white rounded px-2.5 py-1 whitespace-nowrap">{t('downloading', { done: prog.done, total: prog.total, failSuffix: prog.fail ? ` · ${prog.fail} ${t('failWord')}` : '' })}</button>;
  }
  const hasNew = newItems.length > 0 && newItems.length < items.length; // some already downloaded
  return (
    <span className="inline-flex items-center gap-1.5">
      {hasNew && (
        <button onClick={() => run(newItems, t('fileSuffixNew'))} className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded px-2.5 py-1 whitespace-nowrap" title={t('downloadNewTitle')}>
          {t('downloadNew', { count: newItems.length })}
        </button>
      )}
      <button onClick={() => run(items, '')} className="text-xs bg-blue-600 hover:bg-blue-500 text-white rounded px-2.5 py-1 whitespace-nowrap" title={t('downloadAllTitle')}>
        {hasNew ? t('downloadAllShort', { count: items.length }) : newItems.length === 0 && items.length > 0 ? t('redownloadAll', { count: items.length }) : t('downloadAllAuditions', { count: items.length })}
      </button>
    </span>
  );
}

function AdminThread({ briefId, talentId }: { briefId: string; talentId: string }) {
  const t = useTranslations('admin.marketplace');
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
        {messages.length === 0 && <p className="text-xs text-gray-400">{t('threadEmpty')}</p>}
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
          placeholder={t('threadPlaceholder')}
          className="flex-1 bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-900"
        />
        <button onClick={send} disabled={busy || !draft.trim()} className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded px-2 disabled:opacity-50">
          {t('send')}
        </button>
      </div>
    </div>
  );
}
