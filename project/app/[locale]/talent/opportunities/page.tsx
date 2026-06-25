'use client';

/*
  Talent "Opportunities" (案源) — Phase 3c.

  Login-gated (reuses the existing Supabase session from /talent; if none,
  points the talent to log in there rather than duplicating the login form).
  Lists open voice-over briefs and lets the talent submit a quote. The talent
  always sees their NET take-home (after the 20% commission) — gross is what the
  client pays. Onyx mediates the award (managed model), so there's no public
  client-facing auction here. Tri-lingual via the useLocale()+tx() idiom.
*/

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const COMMISSION = 0.2; // display rate; server (net_amount) is source of truth
const CURRENCIES = ['USD', 'TWD', 'HKD', 'CNY', 'EUR', 'GBP', 'JPY', 'SGD'];

type Role = { name?: string; gender?: string; age?: string; personality?: string; emotion?: string; sample_line?: string; is_lead?: boolean; image?: string };
type Brief = {
  id: string;
  brief_number: string;
  kind?: string | null;             // 'casting' = admin casting call
  title?: string | null;
  roles?: Role[] | null;
  audition_script?: string | null;  // shown view-only (no download)
  reference_links?: string[] | null;
  reference_files?: { name?: string; url: string }[] | null;
  recording_start?: string | null;
  recording_methods?: string[] | null;
  rate_note?: string | null;
  base_revisions?: number | null;
  audition_cap?: number | null;
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
  created_at: string;
};
type Quote = {
  id: string;
  brief_id: string;
  role_name?: string | null;
  gross_amount: number;
  net_amount: number;
  currency: string;
  status: string;
  message: string | null;
  sample_url?: string | null;
};
type Demo = { url: string; name?: string; category?: string; language?: string };

const inputCls =
  'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-400/60 transition';

export default function Opportunities() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  const [phase, setPhase] = useState<'loading' | 'nologin' | 'ready'>('loading');
  const [token, setToken] = useState('');
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [roleCounts, setRoleCounts] = useState<Record<string, Record<string, number>>>({});
  const [myDemos, setMyDemos] = useState<Demo[]>([]);

  const load = useCallback(async (accessToken: string) => {
    setToken(accessToken);
    const res = await fetch('/api/talent/briefs', { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.status === 401) return setPhase('nologin');
    const j = await res.json().catch(() => ({}));
    setBriefs(j.briefs || []);
    setQuotes(j.myQuotes || []);
    setRoleCounts(j.roleCounts || {});
    setMyDemos(j.myDemos || []);
    setPhase('ready');
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) await load(data.session.access_token);
      else setPhase('nologin');
    })();
  }, [load]);

  const shell = (inner: React.ReactNode) => (
    <main className="min-h-screen bg-black text-white px-4 py-16">
      <div className="max-w-2xl mx-auto">{inner}</div>
    </main>
  );

  if (phase === 'loading') return shell(<p className="text-gray-500 text-sm text-center py-20">{tx('載入中…', '加载中…', 'Loading…')}</p>);

  if (phase === 'nologin') {
    return shell(
      <div className="text-center py-16">
        <h1 className="text-xl font-semibold mb-3">{tx('案源', '案源', 'Opportunities')}</h1>
        <p className="text-gray-400 text-sm mb-6">{tx('請先登入您的配音員後台。', '请先登录您的配音员后台。', 'Please sign in to your talent dashboard first.')}</p>
        <Link href="/talent" className="text-green-400 hover:underline text-sm">{tx('前往登入 →', '前往登录 →', 'Go to sign in →')}</Link>
      </div>
    );
  }

  return shell(
    <>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold">{tx('案源', '案源', 'Opportunities')}</h1>
        <Link href="/talent" className="text-xs text-gray-400 hover:text-white transition">{tx('← 我的檔案', '← 我的资料', '← My profile')}</Link>
      </div>
      <p className="text-gray-500 text-sm mb-8">
        {tx('以下是開放中的配音需求。報價時您看到的是「淨收入」(已扣 20% 平台費)。', '以下是开放中的配音需求。报价时您看到的是「净收入」(已扣 20% 平台费)。', 'Open voice-over briefs. When you quote, you see your NET take-home (after the 20% platform fee).')}
      </p>

      {briefs.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-16">{tx('目前沒有開放中的案源。之後有新需求會出現在這裡。', '目前没有开放中的案源。之后有新需求会出现在这里。', 'No open briefs right now. New ones will appear here.')}</p>
      )}

      <div className="space-y-4">
        {briefs.map((b) => (
          <BriefCard
            key={b.id}
            brief={b}
            myQuotes={quotes.filter((q) => q.brief_id === b.id)}
            roleCounts={roleCounts[b.id] || {}}
            myDemos={myDemos}
            token={token}
            tx={tx}
            onQuoted={(q) => setQuotes((prev) => [q, ...prev])}
          />
        ))}
      </div>
    </>
  );
}

function BriefCard({
  brief,
  myQuotes,
  roleCounts,
  myDemos,
  token,
  tx,
  onQuoted,
}: {
  brief: Brief;
  myQuotes: Quote[];
  roleCounts: Record<string, number>;
  myDemos: Demo[];
  token: string;
  tx: (tw: string, cn: string, en: string) => string;
  onQuoted: (q: Quote) => void;
}) {
  const popularThreshold = Number(brief.audition_cap) || 5;
  const isCasting = brief.kind === 'casting';
  const hasRoles = (brief.roles || []).length > 0; // casting WITHOUT roles = general single-voice call
  const myQuote = myQuotes[0]; // regular briefs have a single quote per talent
  const [gross, setGross] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const grossN = Number(gross);
  const netPreview = isFinite(grossN) && grossN > 0 ? Math.round(grossN * (1 - COMMISSION) * 100) / 100 : 0;

  async function submitQuote() {
    setErr('');
    if (!isFinite(grossN) || grossN <= 0) return setErr(tx('請輸入大於 0 的金額', '请输入大于 0 的金额', 'Enter an amount greater than 0'));
    setBusy(true);
    const res = await fetch('/api/talent/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ brief_id: brief.id, gross_amount: grossN, currency, message }),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(j.error || tx('送出失敗', '送出失败', 'Submit failed'));
    onQuoted(j.quote);
  }

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 font-mono">{brief.brief_number}</span>
        {brief.deadline && <span className="text-xs text-amber-300/80">{tx('截止', '截止', 'Due')}: {brief.deadline}</span>}
      </div>

      {isCasting ? (
        <>
          {brief.title && <h3 className="text-lg font-semibold text-white mb-1">{brief.title}</h3>}
          <div className="flex flex-wrap gap-1.5 mb-3">
            <span className="text-xs bg-purple-500/15 text-purple-200 px-2 py-0.5 rounded-full">{tx('試音案', '试音案', 'Casting')}</span>
            {brief.language && <span className="text-xs bg-green-500/10 text-green-200 px-2 py-0.5 rounded-full">{brief.language}</span>}
            {brief.rate_note && <span className="text-xs bg-amber-500/15 text-amber-200 px-2 py-0.5 rounded-full">{brief.rate_note}</span>}
            {(brief.recording_methods || []).map((m) => (
              <span key={m} className="text-xs bg-sky-500/15 text-sky-200 px-2 py-0.5 rounded-full">
                {m === 'home' ? tx('在家錄', '在家录', 'Home') : m === 'studio' ? tx('錄音室', '录音室', 'Studio') : m === 'online' ? tx('線上監錄', '线上监录', 'Online') : m}
              </span>
            ))}
          </div>
          {brief.brief && <p className="text-sm text-gray-200 whitespace-pre-wrap mb-3">{brief.brief}</p>}

          {brief.audition_script && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1.5">{tx('試音方向 / 聲音方向(僅供線上閱讀)', '试音方向 / 声音方向(仅供线上阅读)', 'Audition / voice direction (read-only)')}</p>
              <div
                className="text-sm text-gray-200 whitespace-pre-wrap bg-black/40 border border-white/10 rounded-lg p-3 select-none"
                style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                onContextMenu={(e) => e.preventDefault()}
              >
                {brief.audition_script}
              </div>
            </div>
          )}

          {((brief.reference_files || []).length > 0 || (brief.reference_links || []).length > 0) && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1.5">{tx('參考素材(樣音 / 方向)', '参考素材(样音 / 方向)', 'Reference (sample voice / direction)')}</p>
              {(brief.reference_files || []).map((f, i) => (
                <div key={i} className="mb-1.5">
                  {f.name && <span className="text-xs text-gray-400 block mb-0.5">{f.name}</span>}
                  <audio controls src={f.url} className="w-full h-9" />
                </div>
              ))}
              {(brief.reference_links || []).map((l, i) => (
                <a key={i} href={l} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-300 hover:underline block truncate">{l}</a>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
            {brief.audition_deadline && <span>{tx('試音截止', '试音截止', 'Audition due')}: {brief.audition_deadline}</span>}
            {brief.recording_start && <span>{tx('預計開錄', '预计开录', 'Recording starts')}: {brief.recording_start}</span>}
          </div>

          {hasRoles ? (
            /* Per-role auditions. Pick a role → upload an audition for it. Full roles
               grey out (no count shown — we only nudge "try another"). One per role. */
            <div className="border-t border-white/10 pt-3">
              <p className="text-xs text-gray-500 mb-2">{tx('選一個(或多個)角色試音 · 平台不抽成,你報多少拿多少', '选一个(或多个)角色试音 · 平台不抽成,你报多少拿多少', 'Pick a role (or several) to audition · no platform fee, you keep what you quote')}</p>
              <div className="space-y-2">
                {(brief.roles || []).map((ro, i) => (
                  <RoleAudition
                    key={i}
                    brief={brief}
                    role={ro}
                    count={roleCounts[ro.name || ''] || 0}
                    popularThreshold={popularThreshold}
                    done={myQuotes.find((q) => (q.role_name || '') === (ro.name || ''))}
                    token={token}
                    tx={tx}
                    onQuoted={onQuoted}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* General (single-voice) call — respond with an existing demo OR an upload + price. */
            <GeneralResponse brief={brief} myDemos={myDemos} done={myQuotes[0]} token={token} tx={tx} onQuoted={onQuoted} />
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {brief.content_type && <span className="text-xs bg-amber-500/15 text-amber-200 px-2 py-0.5 rounded-full">{brief.content_type}</span>}
            {brief.has_singing && <span className="text-xs bg-pink-500/15 text-pink-200 px-2 py-0.5 rounded-full">{tx('含唱歌', '含唱歌', '+ Singing')}</span>}
            {brief.wants_live_session && <span className="text-xs bg-sky-500/15 text-sky-200 px-2 py-0.5 rounded-full">{tx('線上同步錄音', '线上同步录音', 'Live session')}{brief.live_session_tool ? ` · ${brief.live_session_tool}` : ''}</span>}
            {brief.wants_director && <span className="text-xs bg-sky-500/15 text-sky-200 px-2 py-0.5 rounded-full">{tx('聲音導演', '声音导演', 'Director')}</span>}
            {brief.language && <span className="text-xs bg-green-500/10 text-green-200 px-2 py-0.5 rounded-full">{brief.language}</span>}
            {!brief.content_type && (brief.categories || []).map((c, i) => (
              <span key={i} className="text-xs bg-white/5 border border-white/10 text-gray-300 px-2 py-0.5 rounded-full">{c}</span>
            ))}
          </div>
          <p className="text-sm text-gray-200 whitespace-pre-wrap mb-2">{brief.brief}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
            {brief.media_scope && <span>{tx('媒體', '媒体', 'Media')}: {brief.media_scope}</span>}
            {brief.territory && <span>{tx('地區', '地区', 'Territory')}: {brief.territory}</span>}
            {brief.license_term && <span>{tx('授權', '授权', 'License')}: {brief.license_term}</span>}
            {brief.audition_deadline && <span>{tx('試音截止', '试音截止', 'Audition')}: {brief.audition_deadline}</span>}
            {brief.length && <span>{tx('長度', '长度', 'Length')}: {brief.length}</span>}
            {brief.budget && <span>{tx('預算', '预算', 'Budget')}: {brief.budget_type ? `${brief.budget_type} ` : ''}{brief.budget}</span>}
          </div>

          {myQuote ? (
            <div className="border-t border-white/10 pt-3 text-sm">
              <span className="text-green-300">{tx('已報價', '已报价', 'Quoted')}: {myQuote.currency} {myQuote.net_amount} {tx('(淨收入)', '(净收入)', '(net)')}</span>
              <span className="text-gray-500 ml-2">· {tx('狀態', '状态', 'Status')}: {myQuote.status}</span>
            </div>
          ) : (
            <div className="border-t border-white/10 pt-3 space-y-2">
              <div className="flex gap-2">
                <select className={`${inputCls} w-24`} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => (<option key={c} value={c} className="bg-black">{c}</option>))}
                </select>
                <input type="number" min="0" className={inputCls} value={gross} onChange={(e) => setGross(e.target.value)}
                  placeholder={tx('客戶支付金額(報價)', '客户支付金额(报价)', 'Amount the client pays (your quote)')} />
              </div>
              {grossN > 0 && (
                <p className="text-xs text-green-300">{tx('您的淨收入', '您的净收入', 'Your net take-home')}: {currency} {netPreview} <span className="text-gray-500">({tx('已扣 20% 平台費', '已扣 20% 平台费', 'after 20% fee')})</span></p>
              )}
              <textarea className={`${inputCls} min-h-[60px] resize-y`} value={message} onChange={(e) => setMessage(e.target.value)}
                placeholder={tx('附註(選填):為什麼您適合這個案子…', '附注(选填):为什么您适合这个案子…', 'Note (optional): why you fit this brief…')} />
              {err && <p className="text-red-400 text-xs">{err}</p>}
              <button onClick={submitQuote} disabled={busy} className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold rounded-lg px-4 py-2 text-sm transition">
                {busy ? tx('送出中…', '送出中…', 'Submitting…') : tx('送出報價', '送出报价', 'Submit quote')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// One role's audition: view its line → upload audition → write your price/terms.
// Full roles are disabled (no count shown); near-full nudges to try another.
function RoleAudition({
  brief, role, count, popularThreshold, done, token, tx, onQuoted,
}: {
  brief: Brief;
  role: Role;
  count: number;          // how many have auditioned this role (shown to talents)
  popularThreshold: number; // soft nudge threshold — NOT a hard cap
  done?: Quote;
  token: string;
  tx: (tw: string, cn: string, en: string) => string;
  onQuoted: (q: Quote) => void;
}) {
  const isPopular = count >= popularThreshold;
  const [open, setOpen] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [gross, setGross] = useState('');
  const [currency, setCurrency] = useState('CNY');
  const [intro, setIntro] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const meta = [role.gender, role.age].filter(Boolean).join('·');

  async function uploadAudio(file: File) {
    setErr(''); setUploading(true);
    try {
      const u = await fetch('/api/talent/audition-upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileName: file.name }),
      });
      const uj = await u.json().catch(() => ({}));
      if (!u.ok) throw new Error(uj.error || tx('上傳準備失敗', '上传准备失败', 'Upload prep failed'));
      const { error: upErr } = await supabase.storage.from('casting').uploadToSignedUrl(uj.path, uj.token, file);
      if (upErr) throw new Error(upErr.message);
      setAudioUrl(uj.publicUrl);
    } catch (e) { setErr(e instanceof Error ? e.message : tx('上傳失敗', '上传失败', 'Upload failed')); } finally { setUploading(false); }
  }

  async function submit() {
    setErr('');
    if (!audioUrl) return setErr(tx('請先上傳試音音檔', '请先上传试音音档', 'Please upload your audition first'));
    const g = Number(gross);
    if (!isFinite(g) || g <= 0) return setErr(tx('請填報價', '请填报价', 'Enter your price'));
    setBusy(true);
    const res = await fetch('/api/talent/quotes', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ brief_id: brief.id, role_name: role.name, sample_url: audioUrl, gross_amount: g, currency, intro, message: intro }),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(j.error || tx('送出失敗', '送出失败', 'Submit failed'));
    onQuoted(j.quote);
  }

  // Already auditioned this role.
  if (done) {
    return (
      <div className="rounded-lg px-3 py-2 border border-green-500/30 bg-green-500/5 text-sm">
        <span className="text-gray-100 font-medium">{role.name}</span>{role.is_lead && <span className="ml-1 text-amber-300">★</span>}
        <span className="text-green-300 ml-2">{tx('✓ 已試音', '✓ 已试音', '✓ Auditioned')}</span>
        {done.sample_url && <audio controls src={done.sample_url} className="w-full h-9 mt-2" />}
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${role.is_lead ? 'border-amber-400/30 bg-amber-400/5' : 'border-white/10 bg-white/[0.02]'}`}>
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {role.image && <img src={role.image} alt={role.name} className="w-9 h-9 rounded object-cover shrink-0 border border-white/10" />}
        <span className="flex-1 min-w-0">
          <span className="text-gray-100 font-medium">{role.name}</span>
          {role.is_lead && <span className="ml-1 text-amber-300">★{tx('主角', '主角', 'Lead')}</span>}
          {meta && <span className="text-gray-500 ml-2 text-xs">{meta}</span>}
          {role.personality && <span className="text-gray-400 ml-2 text-xs">{role.personality}</span>}
          <span className={`ml-2 text-xs ${isPopular ? 'text-amber-300' : 'text-gray-500'}`}>· {count} {tx('人已試', '人已试', 'auditioned')}</span>
        </span>
        <span className="text-green-400 text-xs shrink-0">{open ? '▴' : tx('試 ▾', '试 ▾', 'Audition ▾')}</span>
      </button>
      {isPopular && !open && (
        <p className="px-3 pb-2 text-xs text-amber-300/70">{tx('這個角色很多人試了,試別的角色中選機會更高', '这个角色很多人试了,试别的角色中选机会更高', 'This role is popular — try another to improve your odds')}</p>
      )}
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/10 pt-2">
          {role.sample_line && (
            <div className="text-sm text-gray-200 whitespace-pre-wrap bg-black/40 border border-white/10 rounded p-2.5 select-none"
              style={{ userSelect: 'none', WebkitUserSelect: 'none' }} onContextMenu={(e) => e.preventDefault()}>
              {role.sample_line}
            </div>
          )}
          <label className="block">
            <span className="text-xs text-gray-400">{tx('上傳這個角色的試音', '上传这个角色的试音', 'Upload your audition for this role')}</span>
            <input type="file" accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac" disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAudio(f); }}
              className="block w-full text-xs text-gray-400 mt-1 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-white/10 file:text-white file:text-xs" />
          </label>
          {uploading && <p className="text-xs text-gray-400">{tx('上傳中…', '上传中…', 'Uploading…')}</p>}
          {audioUrl && <audio controls src={audioUrl} className="w-full h-9" />}
          <div className="flex gap-2">
            <select className={`${inputCls} w-20 py-1.5`} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (<option key={c} value={c} className="bg-black">{c}</option>))}
            </select>
            <input type="number" min="0" className={`${inputCls} py-1.5`} value={gross} onChange={(e) => setGross(e.target.value)}
              placeholder={tx('你的報價(整案/每句/每小時皆可)', '你的报价(整案/每句/每小时皆可)', 'Your price (per case / per line / per hour)')} />
          </div>
          <textarea className={`${inputCls} min-h-[48px] resize-y`} value={intro} onChange={(e) => setIntro(e.target.value)}
            placeholder={tx('報價說明 + 自我介紹(計價方式、修改政策、為何適合)', '报价说明 + 自我介绍(计价方式、修改政策、为何适合)', 'Pricing notes + intro (how you charge, revisions, why you fit)')} />
          {err && <p className="text-red-400 text-xs">{err}</p>}
          <button onClick={submit} disabled={busy || uploading} className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold rounded-lg px-4 py-1.5 text-sm">
            {busy ? tx('送出中…', '送出中…', 'Submitting…') : tx('送出這個角色的試音', '送出这个角色的试音', 'Submit audition')}
          </button>
        </div>
      )}
    </div>
  );
}

// General (single-voice) casting response: apply with an EXISTING platform demo
// or upload one, then quote a price. No per-role audition — used for ad/narration/
// IVR/audiobook etc. One response per call.
function GeneralResponse({
  brief, myDemos, done, token, tx, onQuoted,
}: {
  brief: Brief;
  myDemos: Demo[];
  done?: Quote;
  token: string;
  tx: (tw: string, cn: string, en: string) => string;
  onQuoted: (q: Quote) => void;
}) {
  const [src, setSrc] = useState<'demo' | 'upload'>(myDemos.length ? 'demo' : 'upload');
  const [pickedDemo, setPickedDemo] = useState(myDemos[0]?.url || '');
  const [audioUrl, setAudioUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [gross, setGross] = useState('');
  const [currency, setCurrency] = useState('CNY');
  const [intro, setIntro] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const sampleUrl = src === 'demo' ? pickedDemo : audioUrl;
  const grossN = Number(gross);

  async function uploadAudio(file: File) {
    setErr(''); setUploading(true);
    try {
      const u = await fetch('/api/talent/audition-upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileName: file.name }),
      });
      const uj = await u.json().catch(() => ({}));
      if (!u.ok) throw new Error(uj.error || tx('上傳準備失敗', '上传准备失败', 'Upload prep failed'));
      const { error: upErr } = await supabase.storage.from('casting').uploadToSignedUrl(uj.path, uj.token, file);
      if (upErr) throw new Error(upErr.message);
      setAudioUrl(uj.publicUrl);
    } catch (e) { setErr(e instanceof Error ? e.message : tx('上傳失敗', '上传失败', 'Upload failed')); } finally { setUploading(false); }
  }

  async function submit() {
    setErr('');
    if (!sampleUrl) return setErr(tx('請選一個 demo 或上傳一段', '请选一个 demo 或上传一段', 'Pick a demo or upload one'));
    if (!isFinite(grossN) || grossN <= 0) return setErr(tx('請填報價', '请填报价', 'Enter your price'));
    setBusy(true);
    const res = await fetch('/api/talent/quotes', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ brief_id: brief.id, sample_url: sampleUrl, gross_amount: grossN, currency, intro, message: intro }),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(j.error || tx('送出失敗', '送出失败', 'Submit failed'));
    onQuoted(j.quote);
  }

  if (done) {
    return (
      <div className="border-t border-white/10 pt-3 text-sm">
        <span className="text-green-300">{tx('已應徵', '已应征', 'Applied')}: {done.currency} {done.net_amount} {tx('(淨收入)', '(净收入)', '(net)')}</span>
        <span className="text-gray-500 ml-2">· {tx('狀態', '状态', 'Status')}: {done.status}</span>
        {done.sample_url && <audio controls src={done.sample_url} className="w-full h-9 mt-2" />}
      </div>
    );
  }

  return (
    <div className="border-t border-white/10 pt-3 space-y-2">
      <p className="text-xs text-gray-500">{tx('用你的 demo 應徵(挑平台現有的,或上傳一段),再報價即可。', '用你的 demo 应征(挑平台现有的,或上传一段),再报价即可。', 'Apply with a demo — pick an existing one or upload — then quote.')}</p>
      {myDemos.length > 0 && (
        <div className="flex gap-2 text-xs">
          {([['demo', '挑現有 demo', '挑现有 demo', 'My demos'], ['upload', '上傳新 demo', '上传新 demo', 'Upload']] as const).map(([k, twl, cnl, enl]) => (
            <button key={k} type="button" onClick={() => setSrc(k)}
              className={`flex-1 rounded-lg px-2 py-1.5 border transition ${src === k ? 'bg-green-500/20 border-green-400/60 text-green-100' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>{tx(twl, cnl, enl)}</button>
          ))}
        </div>
      )}
      {src === 'demo' && myDemos.length > 0 && (
        <div className="space-y-1.5">
          <select className={inputCls} value={pickedDemo} onChange={(e) => setPickedDemo(e.target.value)}>
            {myDemos.map((d, i) => (<option key={i} value={d.url} className="bg-black">{[d.category, d.name, d.language].filter(Boolean).join(' · ') || `Demo ${i + 1}`}</option>))}
          </select>
          {pickedDemo && <audio controls src={pickedDemo} className="w-full h-9" />}
        </div>
      )}
      {src === 'upload' && (
        <>
          <input type="file" accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac" disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAudio(f); }}
            className="block w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-white/10 file:text-white file:text-xs" />
          {uploading && <p className="text-xs text-gray-400">{tx('上傳中…', '上传中…', 'Uploading…')}</p>}
          {audioUrl && <audio controls src={audioUrl} className="w-full h-9" />}
        </>
      )}
      <div className="flex gap-2">
        <select className={`${inputCls} w-20 py-1.5`} value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {CURRENCIES.map((c) => (<option key={c} value={c} className="bg-black">{c}</option>))}
        </select>
        <input type="number" min="0" className={`${inputCls} py-1.5`} value={gross} onChange={(e) => setGross(e.target.value)}
          placeholder={tx('你的報價(整案/每句/每分鐘皆可)', '你的报价(整案/每句/每分钟皆可)', 'Your price (per case / line / minute)')} />
      </div>
      <p className="text-xs text-gray-500">{tx('平台不抽成 —— 你填的就是你實拿。', '平台不抽成 —— 你填的就是你实拿。', 'No platform fee — what you enter is what you take home.')}</p>
      <textarea className={`${inputCls} min-h-[48px] resize-y`} value={intro} onChange={(e) => setIntro(e.target.value)}
        placeholder={tx('報價說明 + 自我介紹(計價方式、修改政策、為何適合)', '报价说明 + 自我介绍(计价方式、修改政策、为何适合)', 'Pricing notes + intro (how you charge, revisions, why you fit)')} />
      {err && <p className="text-red-400 text-xs">{err}</p>}
      <button onClick={submit} disabled={busy || uploading} className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold rounded-lg px-4 py-2 text-sm">
        {busy ? tx('送出中…', '送出中…', 'Submitting…') : tx('送出應徵', '送出应征', 'Submit')}
      </button>
    </div>
  );
}
