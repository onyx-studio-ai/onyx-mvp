'use client';

/*
  Guest audition page (magic-link). No login: the URL token is the identity.
  Reusable + persistent — read now, come back via the same link to upload later;
  prior auditions show on return. Per-role audition (audio + free price + intro).
  After auditioning, an upsell to create a full account keeps everything.
*/

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { toMp3 } from '@/lib/to-mp3';

const CURRENCIES = ['USD', 'TWD'];
const cls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-400/60';
type Role = { name?: string; gender?: string; age?: string; timbre?: string; personality?: string; emotion?: string; speed?: string; volume?: string; note?: string; sample_line?: string; is_lead?: boolean; image?: string };
type Brief = { id: string; source?: 'platform' | 'client'; budget?: string; budget_type?: string; title?: string; language?: string; rate_note?: string; brief?: string; audition_script?: string; audition_deadline?: string; recording_start?: string; recording_methods?: string[]; reference_files?: { name?: string; url: string }[]; reference_links?: string[]; roles?: Role[]; audition_cap?: number; base_revisions?: number; length?: string; deadline?: string; media_scope?: string; territory?: string; license_term?: string; accent?: string; voice_style?: string; voice_age?: string };
type Audition = { id: string; role_name?: string | null; currency: string; gross_amount: number; status: string; sample_url?: string | null };

export default function GuestCasting() {
  const { token } = useParams<{ token: string }>();
  const locale = useLocale();
  const isZh = !locale.startsWith('en');
  const tx = (zh: string, en: string) => (isZh ? zh : en);

  const [phase, setPhase] = useState<'loading' | 'invalid' | 'ready'>('loading');
  const [brief, setBrief] = useState<Brief | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [mine, setMine] = useState<Audition[]>([]);
  const [closed, setClosed] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/casting/${token}`);
    if (!res.ok) return setPhase('invalid');
    const j = await res.json();
    setBrief(j.brief); setCounts(j.roleCounts || {}); setMine(j.myAuditions || []); setClosed(!!j.closed);
    setPhase('ready');
  }, [token]);
  useEffect(() => { load(); }, [load]);

  if (phase === 'loading') return <Shell><p className="text-gray-500 text-sm text-center py-20">{tx('載入中…', 'Loading…')}</p></Shell>;
  if (phase === 'invalid' || !brief) return <Shell><p className="text-gray-400 text-sm text-center py-20">{tx('連結無效或已過期。', 'This link is invalid or expired.')}</p></Shell>;

  return (
    <Shell>
      {brief.title && <h1 className="text-2xl font-semibold mb-2" style={{ fontFamily: '"Songti TC","Noto Serif TC",serif' }}>{brief.title}</h1>}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {brief.source === 'client'
          ? <span className="text-xs px-2.5 py-1 rounded-full bg-[#7fb2e8]/15 text-[#9ec4ee] border border-[#7fb2e8]/30">{tx('客戶委託', 'Client brief')}</span>
          : <span className="text-xs px-2.5 py-1 rounded-full bg-[#C9A86A]/15 text-[#E4CB94] border border-[#C9A86A]/30">{tx('平台發案', 'Onyx-posted')}</span>}
        <span className="text-xs px-2.5 py-1 rounded-full" style={{ color: '#1a160c', background: 'linear-gradient(180deg,#E4CB94,#C9A86A)', fontWeight: 600 }}>{tx('試音邀請', 'Casting')}</span>
        {brief.language && <span className="text-xs bg-white/[0.06] border border-white/10 text-gray-200 px-2.5 py-1 rounded-full">{brief.language}</span>}
      </div>
      {brief.brief && <p className="text-sm text-gray-200 whitespace-pre-wrap mb-3">{brief.brief}</p>}
      <p className="text-xs text-gray-500 mb-4">{tx('免註冊。可以先看,之後點同一條連結回來上傳 —— 進度會保留。', 'No sign-up. Read now, return via the same link to upload later — your progress is kept.')}</p>

      {brief.audition_script && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-1">{tx('試音方向 / 聲音方向', 'Audition / voice direction')}</p>
          <div className="text-sm text-gray-200 whitespace-pre-wrap bg-black/40 border border-white/10 rounded-lg p-3 select-none" style={{ userSelect: 'none' }} onContextMenu={(e) => e.preventDefault()}>{brief.audition_script}</div>
        </div>
      )}
      {((brief.reference_files || []).length > 0 || (brief.reference_links || []).length > 0) && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-1">{tx('參考素材', 'Reference')}</p>
          {(brief.reference_files || []).map((f, i) => <audio key={i} controls src={f.url} className="w-full h-9 mb-1" />)}
          {(brief.reference_links || []).map((l, i) => <a key={i} href={l} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-300 hover:underline block truncate">{l}</a>)}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
        {[
          { l: tx('報酬', 'Rate'), v: brief.rate_note || tx('面議', 'TBD'), gold: true },
          { l: tx('試音截止', 'Audition due'), v: brief.audition_deadline || tx('待定', 'TBD') },
          { l: tx('交付截止', 'Delivery'), v: brief.deadline || tx('待定', 'TBD') },
          { l: tx('規模', 'Scale'), v: brief.length || tx('待定', 'TBD') },
        ].map((s, i) => (
          <div key={i} className="bg-[#1d1b25] border border-white/[0.08] rounded-xl p-3.5">
            <p className="text-[11px] text-gray-500">{s.l}</p>
            <p className={`text-lg font-semibold mt-0.5 ${s.gold ? 'text-[#E4CB94]' : 'text-white'}`} style={{ fontFamily: '"Songti TC","Noto Serif TC",serif' }}>{s.v}</p>
          </div>
        ))}
      </div>
      {(() => {
        const ml = (m: string) => (m === 'home' ? tx('在家錄', 'Home') : m === 'studio' ? tx('錄音室', 'Studio') : m === 'online' ? tx('線上監錄', 'Online') : m);
        const info = ([
          [tx('語言', 'Language'), brief.language],
          [tx('口音', 'Accent'), brief.accent],
          [tx('聲音風格', 'Style'), brief.voice_style],
          [tx('聲音年齡', 'Voice age'), brief.voice_age],
          [tx('使用範圍', 'Usage'), brief.media_scope],
          [tx('地區', 'Territory'), brief.territory],
          [tx('授權', 'License'), brief.license_term],
          [tx('預計開錄', 'Records'), brief.recording_start],
          [tx('含修改', 'Revisions'), brief.base_revisions != null ? `${brief.base_revisions} ${tx('次', '×')}` : ''],
          [tx('錄音方式', 'Recording'), (brief.recording_methods || []).map(ml).join(' / ')],
        ] as [string, string | null | undefined][]).filter((x): x is [string, string] => !!x[1]);
        return info.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-2 text-sm bg-[#1d1b25] border border-white/[0.08] rounded-xl p-4 mb-4">
            {info.map(([k, v], i) => <div key={i} className="min-w-0"><span className="text-gray-500">{k} </span><span className="text-gray-200">{v}</span></div>)}
          </div>
        ) : null;
      })()}

      {closed && <p className="text-amber-300 text-sm mb-3">{tx('這個試音案已結束。', 'This casting call has closed.')}</p>}

      {(brief.roles || []).length > 0 ? (
        <>
          <div className="grid sm:grid-cols-3 gap-2.5 mb-4">
            {[
              { t: tx('一角一檔 · 請勿整軌', 'One file per role'), d: tx('每個角色個別上傳,系統各自建檔;請勿把多角色錄在同一段音檔。', 'Upload each role separately; do not record multiple roles in one file.') },
              { t: tx('檔名自動帶入', 'Auto-named files'), d: tx('提交後系統自動命名「案號_角色_藝名」,無須自行更名。', 'Files are auto-named "case_role_artist" on submit.') },
              { t: tx('音檔格式', 'Audio format'), d: tx('試音檔 MP3 / WAV / M4A 皆可(建議 MP3)。環境安靜、口齒清楚即可。', 'MP3 / WAV / M4A accepted (MP3 preferred). Quiet room, clear delivery.') },
            ].map((r, i) => (
              <div key={i} className="bg-[#1d1b25] border border-white/[0.08] rounded-xl p-3.5">
                <p className="text-sm font-medium text-[#E4CB94] mb-1">{r.t}</p>
                <p className="text-xs text-gray-400 leading-relaxed">{r.d}</p>
              </div>
            ))}
          </div>
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-lg font-semibold text-white" style={{ fontFamily: '"Songti TC","Noto Serif TC",serif' }}>{tx('試音角色', 'Roles')}</h2>
            {(() => { const rs = brief.roles || []; const m = rs.filter((r) => (r.gender || '').includes('男')).length; const f = rs.filter((r) => (r.gender || '').includes('女')).length; return <span className="text-xs text-gray-500">{tx(`共 ${rs.length} 角 · 男 ${m} / 女 ${f}`, `${rs.length} roles · ${m}M / ${f}F`)}</span>; })()}
          </div>
          <p className="text-xs text-gray-400 mb-3">{tx('挑角色 → 唸出它的台詞、錄音 → 上傳 + 報價。可試多角。', 'Pick a role → read its line aloud and record → upload + quote. Audition several.')}</p>
          <div className="space-y-3">
            {(brief.roles || []).map((ro, i) => (
              <GuestRole key={i} token={token} role={ro} count={counts[ro.name || ''] || 0}
                source={brief.source} rateNote={brief.rate_note} budget={brief.budget} budgetType={brief.budget_type}
                popular={(counts[ro.name || ''] || 0) >= (Number(brief.audition_cap) || 5)}
                done={mine.find((m) => (m.role_name || '') === (ro.name || ''))} closed={closed} tx={tx} onDone={(a) => setMine((p) => [a, ...p])} />
            ))}
          </div>
        </>
      ) : (
        /* General (single-voice) call — upload a demo + price (no per-role audition). */
        <GuestGeneral token={token} source={brief.source} rateNote={brief.rate_note} budget={brief.budget} budgetType={brief.budget_type} done={mine.find((m) => !m.role_name)} closed={closed} tx={tx} onDone={(a) => setMine((p) => [a, ...p])} />
      )}

      <div className="mt-8 border-t border-white/10 pt-4 text-center">
        <p className="text-sm text-gray-400 mb-2">{tx('想以後接更多案?建立正式帳號,資料不會遺失。', 'Want more work? Create a full account — nothing is lost.')}</p>
        <Link href="/apply/talent" className="text-green-400 hover:underline text-sm">{tx('建立正式配音員帳號 →', 'Create a talent account →')}</Link>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-black text-white px-4 pt-24 pb-12"><div className="max-w-4xl mx-auto">{children}</div></main>;
}

function GuestRole({ token, role, count, popular, done, closed, source, rateNote, budget, budgetType, tx, onDone }: {
  token: string; role: Role; count: number; popular: boolean; done?: Audition; closed: boolean;
  source?: 'platform' | 'client'; rateNote?: string; budget?: string; budgetType?: string;
  tx: (zh: string, en: string) => string; onDone: (a: Audition) => void;
}) {
  const [open, setOpen] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [gross, setGross] = useState('');
  const [currency, setCurrency] = useState('TWD');
  const [intro, setIntro] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function uploadAudio(rawFile: File) {
    setErr(''); setUploading(true);
    try {
      const file = await toMp3(rawFile); // normalize to MP3 (falls back to original on failure)
      const u = await fetch(`/api/casting/${token}/upload`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name }) });
      const uj = await u.json();
      if (!u.ok) throw new Error(uj.error || tx('上傳準備失敗', 'Upload prep failed'));
      const { error } = await supabase.storage.from('casting').uploadToSignedUrl(uj.path, uj.token, file);
      if (error) throw new Error(error.message);
      setAudioUrl(uj.publicUrl);
    } catch (e) { setErr(e instanceof Error ? e.message : tx('上傳失敗', 'Upload failed')); } finally { setUploading(false); }
  }
  async function submit() {
    setErr('');
    if (!audioUrl) return setErr(tx('請先上傳試音音檔', 'Upload your audition first'));
    const earn = Number(gross); // input = the talent's take-home fee
    if (!(earn > 0)) return setErr(tx('請填報價', 'Enter your price'));
    const grossAmount = source === 'client' ? Math.round((earn / 0.8) * 100) / 100 : earn;
    setBusy(true);
    const res = await fetch(`/api/casting/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role_name: role.name, sample_url: audioUrl, gross_amount: grossAmount, currency, intro }) });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(j.error || tx('送出失敗', 'Submit failed'));
    onDone(j.audition);
  }

  const meta = [role.gender, role.age].filter(Boolean).join(' · ');
  const imageLeft = (
    <div className="w-28 sm:w-36 shrink-0 relative bg-[#14131a]">
      {role.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={role.image} alt={role.name} className="absolute inset-0 w-full h-full object-cover object-top" />
      ) : <div className="absolute inset-0 flex items-center justify-center text-3xl text-gray-600">🎭</div>}
      {role.is_lead && <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded font-medium z-10" style={{ color: '#1a160c', background: 'linear-gradient(180deg,#E4CB94,#C9A86A)' }}>★ {tx('主角', 'Lead')}</span>}
    </div>
  );
  const nameRow = (
    <div className="flex items-start justify-between gap-2">
      <span className="text-lg font-semibold text-white leading-tight" style={{ fontFamily: '"Songti TC","Noto Serif TC",serif' }}>{role.name}</span>
      {meta && <span className="text-xs px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0" style={{ color: '#7fb2e8', background: 'rgba(127,178,232,.14)' }}>{meta}</span>}
    </div>
  );

  if (done) return (
    <div className="flex rounded-2xl overflow-hidden bg-[#1d1b25] border border-[#6FCF97]/30">
      {imageLeft}
      <div className="flex-1 min-w-0 p-4">{nameRow}<p className="text-sm text-[#6FCF97] mt-1.5">{tx('✓ 已試音', '✓ Auditioned')}</p></div>
    </div>
  );

  return (
    <div className={`flex rounded-2xl overflow-hidden bg-[#1d1b25] border ${role.is_lead ? 'border-[#C9A86A]/50' : 'border-white/[0.08]'}`}>
      {imageLeft}
      <div className="flex-1 min-w-0 p-4 space-y-2.5">
        {nameRow}
        {role.timbre && <p className="text-sm text-[#C9A86A] leading-snug">{tx('聲線', 'Voice')} · {role.timbre}</p>}
        {role.personality && <p className="text-sm text-gray-400 leading-snug">{role.personality}</p>}
        {(role.emotion || role.speed || role.volume) && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {role.emotion && <span><span className="text-gray-500">{tx('情緒', 'Emotion')} </span><span className="text-gray-200">{role.emotion}</span></span>}
            {role.speed && <span><span className="text-gray-500">{tx('語速', 'Pace')} </span><span className="text-gray-200">{role.speed}</span></span>}
            {role.volume && <span><span className="text-gray-500">{tx('台詞量', 'Volume')} </span><span className="text-gray-200">{role.volume}</span></span>}
          </div>
        )}
        {role.sample_line && (
          <div className="bg-[#14131a] border border-white/[0.08] rounded-xl px-3.5 py-3 select-none" style={{ userSelect: 'none' }} onContextMenu={(e) => e.preventDefault()}>
            <span className="inline-block text-[11px] tracking-[0.18em] text-[#C9A86A] mb-1">{tx('試音樣詞', 'Audition line')}</span>
            <p className="text-[15px] leading-relaxed text-gray-100 whitespace-pre-wrap">{role.sample_line}</p>
          </div>
        )}
        {role.note && <p className="text-xs text-gray-500 leading-snug"><span className="text-gray-600">{tx('備註', 'Note')} </span>{role.note}</p>}
        <div className="flex items-center justify-between">
          <span className={`text-xs ${popular ? 'text-[#E4CB94]' : 'text-gray-500'}`}>{count} {tx('人已試', 'auditioned')}{popular && tx(' · 熱門', ' · popular')}</span>
          {!closed && (
            <button onClick={() => setOpen((o) => !o)} className="text-sm rounded-xl px-4 py-2"
              style={open ? { border: '1px solid rgba(201,168,106,.4)', color: '#E4CB94', background: 'transparent' } : { color: '#1a160c', background: 'linear-gradient(180deg,#E4CB94,#C9A86A)', fontWeight: 600 }}>{open ? tx('收起', 'Close') : tx('試這個角色 →', 'Audition →')}</button>
          )}
        </div>
        {popular && !open && !closed && <p className="text-[11px] text-[#E4CB94]/70">{tx('很多人試了,試別的中選機會更高', 'Popular — try another for better odds')}</p>}
        {open && !closed && (
          <div className="space-y-2 border-t border-white/[0.08] pt-3">
            <input type="file" accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAudio(f); }}
              className="block w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-white/10 file:text-white file:text-xs" />
            {uploading && <p className="text-xs text-gray-400">{tx('上傳中…', 'Uploading…')}</p>}
            {audioUrl && <audio controls src={audioUrl} className="w-full h-9" />}
            {(() => {
              const isClient = source === 'client';
              const bt = budgetType === 'Up to' ? tx('上限 ', 'Up to ') : budgetType === 'Fixed' ? tx('固定 ', 'Fixed ') : '';
              const val = isClient ? (budget ? `${bt}${budget}` : '') : (rateNote || '');
              return val ? <p className="text-[11px] text-gray-500">{isClient ? tx('客戶預算', 'Client budget') : tx('本案報酬', 'Job budget')} <span className="text-[#E4CB94]">{val}</span></p> : null;
            })()}
            <div className="flex gap-2">
              <select className={`${cls} w-20`} value={currency} onChange={(e) => setCurrency(e.target.value)}>{CURRENCIES.map((c) => <option key={c} value={c} className="bg-black">{c}</option>)}</select>
              <input type="number" min="0" className={cls} value={gross} onChange={(e) => setGross(e.target.value)} placeholder={tx('您的酬勞', 'Your fee')} />
            </div>
            {(() => {
              const isClient = source === 'client'; const earn = Number(gross) || 0;
              if (!isClient) return <p className="text-[11px] text-[#6FCF97]">{tx('平台發案 · 不收取平台費', 'Platform-posted — no platform fee')}</p>;
              if (earn <= 0) return <p className="text-[11px] text-gray-500">{tx('客戶委託 · 平台另收 20% 費用(自動)', 'Client brief — 20% platform fee added (auto)')}</p>;
              const feeAmt = Math.round((earn / 0.8 - earn) * 100) / 100;
              return <p className="text-[11px] text-gray-400">{tx('平台費', 'Platform fee')} 20% {currency} {feeAmt}（{tx('自動', 'auto')}）</p>;
            })()}
            <textarea className={`${cls} min-h-[48px] resize-y`} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder={tx('報價說明 + 自我介紹', 'Pricing + intro')} />
            {err && <p className="text-red-400 text-xs">{err}</p>}
            <button onClick={submit} disabled={busy || uploading} className="w-full disabled:opacity-50 rounded-xl px-4 py-2 text-sm" style={{ color: '#1a160c', background: 'linear-gradient(180deg,#E4CB94,#C9A86A)', fontWeight: 700 }}>{busy ? tx('送出中…', 'Submitting…') : tx('送出試音', 'Submit')}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// General (single-voice) guest response: upload one demo + price. No roles.
function GuestGeneral({ token, done, closed, source, rateNote, budget, budgetType, tx, onDone }: {
  token: string; done?: Audition; closed: boolean; source?: 'platform' | 'client'; rateNote?: string; budget?: string; budgetType?: string;
  tx: (zh: string, en: string) => string; onDone: (a: Audition) => void;
}) {
  const [audioUrl, setAudioUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [gross, setGross] = useState('');
  const [currency, setCurrency] = useState('TWD');
  const [intro, setIntro] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function uploadAudio(rawFile: File) {
    setErr(''); setUploading(true);
    try {
      const file = await toMp3(rawFile); // normalize to MP3 (falls back to original on failure)
      const u = await fetch(`/api/casting/${token}/upload`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name }) });
      const uj = await u.json();
      if (!u.ok) throw new Error(uj.error || tx('上傳準備失敗', 'Upload prep failed'));
      const { error } = await supabase.storage.from('casting').uploadToSignedUrl(uj.path, uj.token, file);
      if (error) throw new Error(error.message);
      setAudioUrl(uj.publicUrl);
    } catch (e) { setErr(e instanceof Error ? e.message : tx('上傳失敗', 'Upload failed')); } finally { setUploading(false); }
  }
  async function submit() {
    setErr('');
    if (!audioUrl) return setErr(tx('請先上傳 demo', 'Upload a demo first'));
    const earn = Number(gross);
    if (!(earn > 0)) return setErr(tx('請填報價', 'Enter your price'));
    const grossAmount = source === 'client' ? Math.round((earn / 0.8) * 100) / 100 : earn;
    setBusy(true);
    const res = await fetch(`/api/casting/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sample_url: audioUrl, gross_amount: grossAmount, currency, intro }) });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(j.error || tx('送出失敗', 'Submit failed'));
    onDone(j.audition);
  }

  if (done) return (
    <div className="rounded-lg px-3 py-2 border border-green-500/30 bg-green-500/5 text-sm">
      <span className="text-green-300">{tx('✓ 已送出', '✓ Submitted')}</span>
      {done.sample_url && <audio controls src={done.sample_url} className="w-full h-9 mt-2" />}
    </div>
  );

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-2">
      <p className="text-xs text-gray-500">{tx('依上方試音稿錄製並上傳你的試音,再填報價。', 'Record your audition from the script above, upload it, then enter your price.')}</p>
      <input type="file" accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac" disabled={uploading || closed} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAudio(f); }}
        className="block w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-white/10 file:text-white file:text-xs" />
      {uploading && <p className="text-xs text-gray-400">{tx('上傳中…', 'Uploading…')}</p>}
      {audioUrl && <audio controls src={audioUrl} className="w-full h-9" />}
      {(() => {
        const isClient = source === 'client';
        const bt = budgetType === 'Up to' ? tx('上限 ', 'Up to ') : budgetType === 'Fixed' ? tx('固定 ', 'Fixed ') : '';
        const val = isClient ? (budget ? `${bt}${budget}` : '') : (rateNote || '');
        return val ? <p className="text-[11px] text-gray-500">{isClient ? tx('客戶預算', 'Client budget') : tx('本案報酬', 'Job budget')} <span className="text-[#E4CB94]">{val}</span></p> : null;
      })()}
      <div className="flex gap-2">
        <select className={`${cls} w-20`} value={currency} onChange={(e) => setCurrency(e.target.value)}>{CURRENCIES.map((c) => <option key={c} value={c} className="bg-black">{c}</option>)}</select>
        <input type="number" min="0" className={cls} value={gross} onChange={(e) => setGross(e.target.value)} placeholder={tx('您的酬勞', 'Your fee')} />
      </div>
      {(() => {
        const isClient = source === 'client'; const earn = Number(gross) || 0;
        if (!isClient) return <p className="text-[11px] text-[#6FCF97]">{tx('平台發案 · 不收取平台費', 'Platform-posted — no platform fee')}</p>;
        if (earn <= 0) return <p className="text-[11px] text-gray-500">{tx('客戶委託 · 平台另收 20% 費用(自動)', 'Client brief — 20% platform fee added (auto)')}</p>;
        const feeAmt = Math.round((earn / 0.8 - earn) * 100) / 100;
        return <p className="text-[11px] text-gray-400">{tx('平台費', 'Platform fee')} 20% {currency} {feeAmt}（{tx('自動', 'auto')}）</p>;
      })()}
      <textarea className={`${cls} min-h-[48px] resize-y`} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder={tx('報價說明 + 自我介紹', 'Pricing + intro')} />
      {err && <p className="text-red-400 text-xs">{err}</p>}
      <button onClick={submit} disabled={busy || uploading || closed} className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold rounded-lg px-4 py-1.5 text-sm">{busy ? tx('送出中…', 'Submitting…') : tx('送出應徵', 'Submit')}</button>
    </div>
  );
}
