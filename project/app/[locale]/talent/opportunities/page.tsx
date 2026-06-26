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
import { caseCode } from '@/lib/casting';
import { toMp3 } from '@/lib/to-mp3';

const COMMISSION = 0.2; // display rate; server (net_amount) is source of truth
const CURRENCIES = ['USD', 'TWD'];

type Role = { name?: string; gender?: string; age?: string; personality?: string; emotion?: string; speed?: string; sample_line?: string; is_lead?: boolean; image?: string };
type Brief = {
  id: string;
  brief_number: string;
  kind?: string | null;             // 'casting' = admin casting call
  source?: 'platform' | 'client';   // who posted it (no client identity leaked)
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
  accent: string | null;
  voice_style: string | null;
  voice_age: string | null;
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
    <main className="min-h-screen bg-black text-white px-4 pt-24 pb-16">
      <div className="max-w-4xl mx-auto">{inner}</div>
    </main>
  );

  if (phase === 'loading') return shell(<p className="text-gray-500 text-sm text-center py-20">{tx('載入中…', '加载中…', 'Loading…')}</p>);

  if (phase === 'nologin') {
    return shell(
      <div className="text-center py-16">
        <h1 className="text-xl font-semibold mb-3">{tx('案件', '案件', 'Cases')}</h1>
        <p className="text-gray-400 text-sm mb-6">{tx('請先登入您的配音員後台。', '请先登录您的配音员后台。', 'Please sign in to your talent dashboard first.')}</p>
        <Link href="/talent" className="text-green-400 hover:underline text-sm">{tx('前往登入 →', '前往登录 →', 'Go to sign in →')}</Link>
      </div>
    );
  }

  return shell(
    <>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold">{tx('案件', '案件', 'Cases')}</h1>
        <Link href="/talent" className="text-xs text-gray-400 hover:text-white transition">{tx('← 我的檔案', '← 我的资料', '← My profile')}</Link>
      </div>
      <p className="text-gray-500 text-sm mb-8">
        {tx('以下是 Onyx 開放中的配音需求。報酬是該案配音員實際收入。', '以下是 Onyx 开放中的配音需求。报酬是该案配音员实际收入。', "These are Onyx's open voice-over cases. The rate shown is the talent's actual take-home.")}
      </p>

      {briefs.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-16">{tx('目前沒有開放中的案件。之後有新案件會出現在這裡。', '目前没有开放中的案件。之后有新案件会出现在这里。', 'No open cases right now. New ones will appear here.')}</p>
      )}

      <div className="space-y-3">
        {briefs.map((b) => (
          <BriefCard
            key={b.id}
            brief={b}
            defaultOpen={false}
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
  defaultOpen,
  myQuotes,
  roleCounts,
  myDemos,
  token,
  tx,
  onQuoted,
}: {
  brief: Brief;
  defaultOpen?: boolean;
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
  const [open, setOpen] = useState(!!defaultOpen);
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
    <div className={`bg-white/[0.02] border rounded-2xl overflow-hidden transition ${open ? 'border-white/15' : 'border-white/10 hover:border-white/20'}`}>
      <CaseHeader brief={brief} isCasting={isCasting} roleCount={(brief.roles || []).length} hasMine={myQuotes.length > 0} open={open} onToggle={() => setOpen((o) => !o)} tx={tx} />

      {open && (
      <div className="px-5 pb-5">
      {isCasting ? (
        <>
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

          {/* stat-card summary — the four headline facts (待定 if not set yet) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
            {[
              { l: tx('報酬', '报酬', 'Rate'), v: brief.rate_note || tx('面議', '面议', 'TBD'), gold: true },
              { l: tx('試音截止', '试音截止', 'Audition due'), v: brief.audition_deadline || tx('待定', '待定', 'TBD') },
              { l: tx('交付截止', '交付截止', 'Delivery'), v: brief.deadline || tx('待定', '待定', 'TBD') },
              { l: tx('規模', '规模', 'Scale'), v: brief.length || tx('待定', '待定', 'TBD') },
            ].map((s, i) => (
              <div key={i} className="bg-[#1d1b25] border border-white/[0.08] rounded-xl p-3.5">
                <p className="text-[11px] text-gray-500">{s.l}</p>
                <p className={`text-lg font-semibold mt-0.5 ${s.gold ? 'text-[#E4CB94]' : 'text-white'}`} style={{ fontFamily: '"Songti TC","Noto Serif TC",serif' }}>{s.v}</p>
              </div>
            ))}
          </div>
          {/* detail grid — every other field filled in, in a tidy key:value block */}
          {(() => {
            const methodLabel = (m: string) => (m === 'home' ? tx('在家錄', '在家录', 'Home') : m === 'studio' ? tx('錄音室', '录音室', 'Studio') : m === 'online' ? tx('線上監錄', '线上监录', 'Online') : m);
            const info: [string, string][] = ([
              [tx('語言', '语言', 'Language'), brief.language],
              [tx('口音', '口音', 'Accent'), brief.accent],
              [tx('聲音風格', '声音风格', 'Style'), brief.voice_style],
              [tx('聲音年齡', '声音年龄', 'Voice age'), brief.voice_age],
              [tx('使用範圍', '使用范围', 'Usage'), brief.media_scope],
              [tx('地區', '地区', 'Territory'), brief.territory],
              [tx('授權', '授权', 'License'), brief.license_term],
              [tx('預計開錄', '预计开录', 'Records'), brief.recording_start],
              [tx('含修改', '含修改', 'Revisions'), brief.base_revisions != null ? `${brief.base_revisions} ${tx('次', '次', '×')}` : ''],
              [tx('錄音方式', '录音方式', 'Recording'), (brief.recording_methods || []).map(methodLabel).join(' / ')],
            ] as [string, string | null | undefined][]).filter((x): x is [string, string] => !!x[1]);
            return info.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-2 text-sm bg-[#1d1b25] border border-white/[0.08] rounded-xl p-4 mb-4">
                {info.map(([k, v], i) => <div key={i} className="min-w-0"><span className="text-gray-500">{k} </span><span className="text-gray-200">{v}</span></div>)}
              </div>
            ) : null;
          })()}

          {hasRoles ? (
            <div className="border-t border-white/10 pt-4">
              {/* submission rules — official, so talent knows the requirements up front */}
              <div className="grid sm:grid-cols-3 gap-2.5 mb-4">
                {[
                  { t: tx('一角一檔 · 請勿整軌', '一角一档 · 请勿整轨', 'One file per role'), d: tx('每個角色個別上傳,系統各自建檔;請勿把多角色錄在同一段音檔。', '每个角色个别上传,系统各自建档;请勿把多角色录在同一段音档。', 'Upload each role separately; do not record multiple roles in one file.') },
                  { t: tx('檔名自動帶入', '档名自动带入', 'Auto-named files'), d: tx('提交後系統自動命名「案號_角色_藝名」,無須自行更名。', '提交后系统自动命名「案号_角色_艺名」,无须自行更名。', 'Files are auto-named "case_role_artist" on submit.') },
                  { t: tx('音檔格式', '音档格式', 'Audio format'), d: tx('試音檔 MP3 / WAV / M4A 皆可(建議 MP3)。環境安靜、口齒清楚即可;正式錄製再要求 48kHz / 24-bit。', '试音档 MP3 / WAV / M4A 皆可(建议 MP3)。环境安静、口齿清楚即可;正式录制再要求 48kHz / 24-bit。', 'MP3 / WAV / M4A accepted (MP3 preferred). Quiet room, clear delivery; full 48k/24-bit only for final record.') },
                ].map((r, i) => (
                  <div key={i} className="bg-[#1d1b25] border border-white/[0.08] rounded-xl p-3.5">
                    <p className="text-sm font-medium text-[#E4CB94] mb-1">{r.t}</p>
                    <p className="text-xs text-gray-400 leading-relaxed">{r.d}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-baseline justify-between mb-1">
                <h4 className="text-lg font-semibold text-white" style={{ fontFamily: '"Songti TC","Noto Serif TC",serif' }}>{tx('試音角色', '试音角色', 'Roles')}</h4>
                {(() => { const rs = brief.roles || []; const m = rs.filter((r) => (r.gender || '').includes('男')).length; const f = rs.filter((r) => (r.gender || '').includes('女')).length; return <span className="text-xs text-gray-500">{tx(`共 ${rs.length} 角 · 男 ${m} / 女 ${f}`, `共 ${rs.length} 角 · 男 ${m} / 女 ${f}`, `${rs.length} roles · ${m}M / ${f}F`)}</span>; })()}
              </div>
              <p className="text-xs text-gray-400 mb-3">{tx('挑選角色 → 唸出台詞並錄音 → 上傳試音並報價。可應徵多個角色。', '挑选角色 → 念出台词并录音 → 上传试音并报价。可应征多个角色。', 'Pick a role → read its line aloud and record → upload your audition and quote. You may audition for several roles.')}</p>
              <div className="space-y-3">
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
      )}
    </div>
  );
}

// Compact, always-visible case header (Voices-style list row). Click to expand the
// full detail below. Shows the headline facts so several cases scan at a glance.
function CaseHeader({
  brief, isCasting, roleCount, hasMine, open, onToggle, tx,
}: {
  brief: Brief;
  isCasting: boolean;
  roleCount: number;
  hasMine: boolean;
  open: boolean;
  onToggle: () => void;
  tx: (tw: string, cn: string, en: string) => string;
}) {
  const due = brief.audition_deadline || brief.deadline;
  const cat = brief.content_type || (brief.categories || [])[0];
  return (
    <button onClick={onToggle} className="w-full text-left px-5 py-4 hover:bg-white/[0.02] transition">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className="text-xs text-gray-500 font-mono">{isCasting ? caseCode(brief) : brief.brief_number}</span>
            {brief.source === 'client'
              ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#7fb2e8]/15 text-[#9ec4ee] border border-[#7fb2e8]/30">{tx('客戶委託', '客户委托', 'Client brief')}</span>
              : <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#C9A86A]/15 text-[#E4CB94] border border-[#C9A86A]/30">{tx('平台發案', '平台发案', 'Onyx-posted')}</span>}
            {isCasting
              ? <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ color: '#1a160c', background: 'linear-gradient(180deg,#E4CB94,#C9A86A)', fontWeight: 600 }}>{tx('試音案', '试音案', 'Casting')}</span>
              : cat && <span className="text-[11px] bg-amber-500/15 text-amber-200 px-2 py-0.5 rounded-full">{cat}</span>}
            {brief.language && <span className="text-[11px] bg-white/[0.06] border border-white/10 text-gray-300 px-2 py-0.5 rounded-full">{brief.language}</span>}
            {brief.has_singing && <span className="text-[11px] bg-pink-500/15 text-pink-200 px-2 py-0.5 rounded-full">{tx('含唱歌', '含唱歌', 'Singing')}</span>}
            {brief.wants_live_session && <span className="text-[11px] bg-sky-500/15 text-sky-200 px-2 py-0.5 rounded-full">{tx('線上監錄', '线上监录', 'Live')}</span>}
            {brief.wants_director && <span className="text-[11px] bg-sky-500/15 text-sky-200 px-2 py-0.5 rounded-full">{tx('聲音導演', '声音导演', 'Director')}</span>}
          </div>
          <h3 className="text-xl font-semibold text-white leading-snug truncate" style={{ fontFamily: '"Songti TC","Noto Serif TC",serif' }}>
            {brief.title || cat || tx('配音案', '配音案', 'Voice case')}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs">
            {brief.rate_note && <span className="text-[#E4CB94] font-medium">{brief.rate_note}</span>}
            {isCasting && roleCount > 0 && <span className="text-gray-400">{tx(`共 ${roleCount} 角`, `共 ${roleCount} 角`, `${roleCount} roles`)}</span>}
            {!isCasting && brief.budget && <span className="text-gray-400">{tx('預算', '预算', 'Budget')} {brief.budget_type ? `${brief.budget_type} ` : ''}{brief.budget}</span>}
            {due && <span className="text-amber-300/80">{tx('截止', '截止', 'Due')} {due}</span>}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2 pt-0.5">
          {hasMine && <span className="text-[11px] text-[#6FCF97] whitespace-nowrap">{tx('已試', '已试', 'Done')}</span>}
          <span className={`text-gray-500 text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </div>
    </button>
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
  const [currency, setCurrency] = useState('TWD');
  const [intro, setIntro] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const meta = [role.gender, role.age].filter(Boolean).join('·');

  async function uploadAudio(rawFile: File) {
    setErr(''); setUploading(true);
    try {
      const file = await toMp3(rawFile); // normalize to MP3 (falls back to original on failure)
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
    const earn = Number(gross); // input = the talent's take-home fee
    if (!isFinite(earn) || earn <= 0) return setErr(tx('請填報價', '请填报价', 'Enter your price'));
    // client cases: platform adds 20% on top → the client pays earn / 0.8
    const grossAmount = brief.source === 'client' ? Math.round((earn / 0.8) * 100) / 100 : earn;
    setBusy(true);
    const res = await fetch('/api/talent/quotes', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ brief_id: brief.id, role_name: role.name, sample_url: audioUrl, gross_amount: grossAmount, currency, intro, message: intro }),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(j.error || tx('送出失敗', '送出失败', 'Submit failed'));
    onQuoted(j.quote);
  }

  // Horizontal card — portrait on the left, all info on the right, so it stays
  // compact and several roles fit on screen at once.
  const imageLeft = (
    <div className="w-28 sm:w-36 shrink-0 relative bg-[#14131a]">
      {role.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={role.image} alt={role.name} className="absolute inset-0 w-full h-full object-cover object-top" />
      ) : <div className="absolute inset-0 flex items-center justify-center text-3xl text-gray-600">🎭</div>}
      {role.is_lead && <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded font-medium z-10" style={{ color: '#1a160c', background: 'linear-gradient(180deg,#E4CB94,#C9A86A)' }}>★ {tx('主角', '主角', 'Lead')}</span>}
    </div>
  );
  const nameRow = (
    <div className="flex items-start justify-between gap-2">
      <span className="text-lg font-semibold text-white leading-tight" style={{ fontFamily: '"Songti TC","Noto Serif TC",serif' }}>{role.name}</span>
      {meta && <span className="text-xs px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0" style={{ color: '#7fb2e8', background: 'rgba(127,178,232,.14)' }}>{meta}</span>}
    </div>
  );

  // Already auditioned this role.
  if (done) {
    return (
      <div className="flex rounded-2xl overflow-hidden bg-[#1d1b25] border border-[#6FCF97]/30">
        {imageLeft}
        <div className="flex-1 min-w-0 p-4">
          {nameRow}
          <p className="text-sm text-[#6FCF97] mt-1.5">{tx('✓ 已試音', '✓ 已试音', '✓ Auditioned')}</p>
          {done.sample_url && <audio controls src={done.sample_url} className="w-full h-9 mt-2" />}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex rounded-2xl overflow-hidden bg-[#1d1b25] border transition ${role.is_lead ? 'border-[#C9A86A]/50' : 'border-white/[0.08]'} hover:border-[#C9A86A]/40`}>
      {imageLeft}
      <div className="flex-1 min-w-0 p-4 space-y-2.5">
        {nameRow}
        {role.personality && <p className="text-sm text-gray-400 leading-snug">{role.personality}</p>}

        {(role.emotion || role.speed) && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {role.emotion && <span><span className="text-gray-500">{tx('情緒', '情绪', 'Emotion')} </span><span className="text-gray-200">{role.emotion}</span></span>}
            {role.speed && <span><span className="text-gray-500">{tx('語速', '语速', 'Pace')} </span><span className="text-gray-200">{role.speed}</span></span>}
          </div>
        )}

        {role.sample_line && (
          <div className="bg-[#14131a] border border-white/[0.08] rounded-xl px-3.5 py-3 select-none"
            style={{ userSelect: 'none', WebkitUserSelect: 'none' }} onContextMenu={(e) => e.preventDefault()}>
            <span className="inline-block text-[11px] tracking-[0.18em] text-[#C9A86A] mb-1">{tx('試音樣詞', '试音样词', 'Audition line')}</span>
            <p className="text-[15px] leading-relaxed text-gray-100 whitespace-pre-wrap">{role.sample_line}</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className={`text-xs ${isPopular ? 'text-[#E4CB94]' : 'text-gray-500'}`}>{count} {tx('人已試', '人已试', 'auditioned')}{isPopular && tx(' · 熱門', ' · 热门', ' · popular')}</span>
          <button onClick={() => setOpen((o) => !o)} className="text-sm rounded-xl px-4 py-2 transition"
            style={open ? { border: '1px solid rgba(201,168,106,.4)', color: '#E4CB94', background: 'transparent' } : { color: '#1a160c', background: 'linear-gradient(180deg,#E4CB94,#C9A86A)', fontWeight: 600 }}>
            {open ? tx('收起', '收起', 'Close') : tx('試這個角色 →', '试这个角色 →', 'Audition →')}
          </button>
        </div>
        {isPopular && !open && <p className="text-[11px] text-[#E4CB94]/70">{tx('很多人試了,試別的中選機會更高', '很多人试了,试别的中选机会更高', 'Popular — try another for better odds')}</p>}

        {open && (
          <div className="space-y-2 border-t border-white/[0.08] pt-3">
            <label className="block">
              <span className="text-xs text-gray-400">{tx('上傳這個角色的試音(唸上面的樣詞)', '上传这个角色的试音(念上面的样词)', 'Upload your audition (read the line above)')}</span>
              <input type="file" accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac" disabled={uploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAudio(f); }}
                className="block w-full text-xs text-gray-400 mt-1 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-white/10 file:text-white file:text-xs" />
            </label>
            {uploading && <p className="text-xs text-gray-400">{tx('上傳中…', '上传中…', 'Uploading…')}</p>}
            {audioUrl && <audio controls src={audioUrl} className="w-full h-9" />}
            {brief.rate_note && <p className="text-[11px] text-gray-500">{tx('本案報酬', '本案报酬', 'Job budget')} <span className="text-[#E4CB94]">{brief.rate_note}</span></p>}
            <div className="flex gap-2">
              <select className={`${inputCls} w-20 py-1.5`} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (<option key={c} value={c} className="bg-black">{c}</option>))}
              </select>
              <input type="number" min="0" className={`${inputCls} py-1.5`} value={gross} onChange={(e) => setGross(e.target.value)}
                placeholder={tx('您的酬勞', '您的酬劳', 'Your fee')} />
            </div>
            {(() => {
              const isClient = brief.source === 'client'; const earn = Number(gross) || 0;
              if (!isClient) return <p className="text-[11px] text-[#6FCF97]">{tx('平台發案 · 不收取平台費', '平台发案 · 不收取平台费', 'Platform-posted — no platform fee')}</p>;
              if (earn <= 0) return <p className="text-[11px] text-gray-500">{tx('客戶委託 · 平台另收 20% 費用(自動計算)', '客户委托 · 平台另收 20% 费用(自动计算)', 'Client brief — 20% platform fee added (auto)')}</p>;
              const feeAmt = Math.round((earn / 0.8 - earn) * 100) / 100;
              return <p className="text-[11px] text-gray-400">{tx('平台費', '平台费', 'Platform fee')} 20% {currency} {feeAmt}（{tx('自動', '自动', 'auto')}）</p>;
            })()}
            <textarea className={`${inputCls} min-h-[48px] resize-y`} value={intro} onChange={(e) => setIntro(e.target.value)}
              placeholder={tx('報價說明 + 自我介紹', '报价说明 + 自我介绍', 'Pricing notes + intro')} />
            {err && <p className="text-red-400 text-xs">{err}</p>}
            <button onClick={submit} disabled={busy || uploading} className="w-full disabled:opacity-50 rounded-xl px-4 py-2 text-sm"
              style={{ color: '#1a160c', background: 'linear-gradient(180deg,#E4CB94,#C9A86A)', fontWeight: 700 }}>
              {busy ? tx('送出中…', '送出中…', 'Submitting…') : tx('送出試音', '送出试音', 'Submit audition')}
            </button>
          </div>
        )}
      </div>
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
  const [currency, setCurrency] = useState('TWD');
  const [intro, setIntro] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const sampleUrl = src === 'demo' ? pickedDemo : audioUrl;
  const grossN = Number(gross);

  async function uploadAudio(rawFile: File) {
    setErr(''); setUploading(true);
    try {
      const file = await toMp3(rawFile); // normalize to MP3 (falls back to original on failure)
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
    const grossAmount = brief.source === 'client' ? Math.round((grossN / 0.8) * 100) / 100 : grossN; // client: +20% on top
    setBusy(true);
    const res = await fetch('/api/talent/quotes', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ brief_id: brief.id, sample_url: sampleUrl, gross_amount: grossAmount, currency, intro, message: intro }),
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
          placeholder={tx('您的酬勞(整案/每句/每分鐘)', '您的酬劳(整案/每句/每分钟)', 'Your fee (per case / line / minute)')} />
      </div>
      {(() => {
        const isClient = brief.source === 'client'; const earn = Number(gross) || 0;
        if (!isClient) return <p className="text-xs text-[#6FCF97]">{tx('平台發案 · 不收取平台費', '平台发案 · 不收取平台费', 'Platform-posted — no platform fee')}</p>;
        if (earn <= 0) return <p className="text-xs text-gray-500">{tx('客戶委託 · 平台另收 20% 費用(自動計算)', '客户委托 · 平台另收 20% 费用(自动计算)', 'Client brief — 20% platform fee added (auto)')}</p>;
        const feeAmt = Math.round((earn / 0.8 - earn) * 100) / 100;
        return <p className="text-xs text-gray-400">{tx('平台費', '平台费', 'Platform fee')} 20% {currency} {feeAmt}（{tx('自動', '自动', 'auto')}）</p>;
      })()}
      <textarea className={`${inputCls} min-h-[48px] resize-y`} value={intro} onChange={(e) => setIntro(e.target.value)}
        placeholder={tx('報價說明 + 自我介紹(計價方式、修改政策、為何適合)', '报价说明 + 自我介绍(计价方式、修改政策、为何适合)', 'Pricing notes + intro (how you charge, revisions, why you fit)')} />
      {err && <p className="text-red-400 text-xs">{err}</p>}
      <button onClick={submit} disabled={busy || uploading} className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold rounded-lg px-4 py-2 text-sm">
        {busy ? tx('送出中…', '送出中…', 'Submitting…') : tx('送出應徵', '送出应征', 'Submit')}
      </button>
    </div>
  );
}
