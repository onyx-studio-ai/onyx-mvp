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

const CURRENCIES = ['CNY', 'TWD', 'USD', 'HKD', 'EUR', 'GBP', 'JPY', 'SGD'];
const cls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-400/60';
type Role = { name?: string; gender?: string; age?: string; personality?: string; sample_line?: string; is_lead?: boolean; image?: string };
type Brief = { id: string; title?: string; language?: string; rate_note?: string; brief?: string; audition_script?: string; audition_deadline?: string; recording_start?: string; recording_methods?: string[]; reference_files?: { name?: string; url: string }[]; reference_links?: string[]; roles?: Role[]; audition_cap?: number };
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
      {brief.title && <h1 className="text-2xl font-semibold mb-1">{brief.title}</h1>}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="text-xs bg-purple-500/15 text-purple-200 px-2 py-0.5 rounded-full">{tx('試音邀請', 'Casting')}</span>
        {brief.language && <span className="text-xs bg-green-500/10 text-green-200 px-2 py-0.5 rounded-full">{brief.language}</span>}
        {brief.rate_note && <span className="text-xs bg-amber-500/15 text-amber-200 px-2 py-0.5 rounded-full">{brief.rate_note}</span>}
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

      <div className="flex flex-wrap gap-x-4 text-xs text-gray-500 mb-3">
        {brief.audition_deadline && <span>{tx('試音截止', 'Due')}: {brief.audition_deadline}</span>}
        {brief.recording_start && <span>{tx('預計開錄', 'Recording')}: {brief.recording_start}</span>}
      </div>

      {closed && <p className="text-amber-300 text-sm mb-3">{tx('這個試音案已結束。', 'This casting call has closed.')}</p>}

      {(brief.roles || []).length > 0 ? (
        <>
          <p className="text-xs text-gray-500 mb-2">{tx('選角色試音(可試多個)· 平台不抽成,你報多少拿多少:', 'Pick roles to audition · no platform fee, you keep what you quote:')}</p>
          <div className="grid grid-cols-2 gap-3 items-start">
            {(brief.roles || []).map((ro, i) => (
              <GuestRole key={i} token={token} role={ro} count={counts[ro.name || ''] || 0}
                popular={(counts[ro.name || ''] || 0) >= (Number(brief.audition_cap) || 5)}
                done={mine.find((m) => (m.role_name || '') === (ro.name || ''))} closed={closed} tx={tx} onDone={(a) => setMine((p) => [a, ...p])} />
            ))}
          </div>
        </>
      ) : (
        /* General (single-voice) call — upload a demo + price (no per-role audition). */
        <GuestGeneral token={token} done={mine.find((m) => !m.role_name)} closed={closed} tx={tx} onDone={(a) => setMine((p) => [a, ...p])} />
      )}

      <div className="mt-8 border-t border-white/10 pt-4 text-center">
        <p className="text-sm text-gray-400 mb-2">{tx('想以後接更多案?建立正式帳號,資料不會遺失。', 'Want more work? Create a full account — nothing is lost.')}</p>
        <Link href="/apply/talent" className="text-green-400 hover:underline text-sm">{tx('建立正式配音員帳號 →', 'Create a talent account →')}</Link>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-black text-white px-4 py-12"><div className="max-w-2xl mx-auto">{children}</div></main>;
}

function GuestRole({ token, role, count, popular, done, closed, tx, onDone }: {
  token: string; role: Role; count: number; popular: boolean; done?: Audition; closed: boolean;
  tx: (zh: string, en: string) => string; onDone: (a: Audition) => void;
}) {
  const [open, setOpen] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [gross, setGross] = useState('');
  const [currency, setCurrency] = useState('CNY');
  const [intro, setIntro] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function uploadAudio(file: File) {
    setErr(''); setUploading(true);
    try {
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
    if (!(Number(gross) > 0)) return setErr(tx('請填報價', 'Enter your price'));
    setBusy(true);
    const res = await fetch(`/api/casting/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role_name: role.name, sample_url: audioUrl, gross_amount: Number(gross), currency, intro }) });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(j.error || tx('送出失敗', 'Submit failed'));
    onDone(j.audition);
  }

  if (done) return (
    <div className="rounded-xl border border-green-500/30 bg-green-500/[0.06] overflow-hidden">
      <div className="h-20 bg-white/5 flex items-center justify-center">
        {role.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={role.image} alt={role.name} className="w-full h-full object-cover" />
        ) : <span className="text-green-300 text-2xl">✓</span>}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-gray-100">{role.name}{role.is_lead && <span className="ml-1 text-amber-300">★</span>} <span className="text-green-300 text-xs">{tx('✓ 已試音', '✓ Auditioned')}</span></p>
      </div>
    </div>
  );

  return (
    <div className={`rounded-xl border overflow-hidden ${role.is_lead ? 'border-amber-400/40 bg-amber-400/[0.04]' : 'border-white/10 bg-white/[0.02]'}`}>
      <div className="h-24 bg-white/[0.04] flex items-center justify-center relative">
        {role.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={role.image} alt={role.name} className="w-full h-full object-cover" />
        ) : <span className="text-gray-600 text-2xl">🎭</span>}
        {role.is_lead && <span className="absolute top-1.5 left-1.5 text-[10px] bg-amber-400 text-black font-medium px-1.5 py-0.5 rounded">★{tx('主角', 'Lead')}</span>}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-gray-100">{role.name}</p>
        {([role.gender, role.age].filter(Boolean).join('·') || role.personality) && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{[[role.gender, role.age].filter(Boolean).join('·'), role.personality].filter(Boolean).join(' · ')}</p>
        )}
        {role.sample_line && (
          <div className="mt-2">
            <p className="text-[10px] text-gray-500 mb-0.5 tracking-wide">{tx('台詞', 'Line')}</p>
            <p className={`text-xs text-gray-300 leading-relaxed border-l-2 border-white/15 pl-2 select-none ${open ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}
              style={{ userSelect: 'none' }} onContextMenu={(e) => e.preventDefault()}>{role.sample_line}</p>
          </div>
        )}
        <div className="flex items-center justify-between mt-2.5">
          <span className={`text-xs ${popular ? 'text-amber-300' : 'text-gray-500'}`}>{count} {tx('人已試', 'auditioned')}{popular && tx(' · 熱門', ' · popular')}</span>
          {!closed && (
            <button onClick={() => setOpen((o) => !o)} className="text-xs bg-green-500 hover:bg-green-400 text-black font-medium rounded-lg px-3 py-1 transition">{open ? tx('收起', 'Close') : tx('試音 →', 'Audition →')}</button>
          )}
        </div>
        {popular && !open && !closed && <p className="text-[11px] text-amber-300/70 mt-1.5">{tx('很多人試了,試別的中選機會更高', 'Popular — try another for better odds')}</p>}
        {open && !closed && (
          <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
            <input type="file" accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAudio(f); }}
              className="block w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-white/10 file:text-white file:text-xs" />
            {uploading && <p className="text-xs text-gray-400">{tx('上傳中…', 'Uploading…')}</p>}
            {audioUrl && <audio controls src={audioUrl} className="w-full h-9" />}
            <div className="flex gap-2">
              <select className={`${cls} w-20`} value={currency} onChange={(e) => setCurrency(e.target.value)}>{CURRENCIES.map((c) => <option key={c} value={c} className="bg-black">{c}</option>)}</select>
              <input type="number" min="0" className={cls} value={gross} onChange={(e) => setGross(e.target.value)} placeholder={tx('你的報價(你實拿)', 'Your price (you keep it all)')} />
            </div>
            <textarea className={`${cls} min-h-[48px] resize-y`} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder={tx('報價說明 + 自我介紹', 'Pricing + intro')} />
            {err && <p className="text-red-400 text-xs">{err}</p>}
            <button onClick={submit} disabled={busy || uploading} className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold rounded-lg px-4 py-1.5 text-sm">{busy ? tx('送出中…', 'Submitting…') : tx('送出試音', 'Submit')}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// General (single-voice) guest response: upload one demo + price. No roles.
function GuestGeneral({ token, done, closed, tx, onDone }: {
  token: string; done?: Audition; closed: boolean;
  tx: (zh: string, en: string) => string; onDone: (a: Audition) => void;
}) {
  const [audioUrl, setAudioUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [gross, setGross] = useState('');
  const [currency, setCurrency] = useState('CNY');
  const [intro, setIntro] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function uploadAudio(file: File) {
    setErr(''); setUploading(true);
    try {
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
    if (!(Number(gross) > 0)) return setErr(tx('請填報價', 'Enter your price'));
    setBusy(true);
    const res = await fetch(`/api/casting/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sample_url: audioUrl, gross_amount: Number(gross), currency, intro }) });
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
      <p className="text-xs text-gray-500">{tx('上傳一段 demo + 報價即可(不需逐角色錄)。平台不抽成,你報多少拿多少。', 'Upload one demo + your price (no per-role recording). No platform fee — you keep what you quote.')}</p>
      <input type="file" accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac" disabled={uploading || closed} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAudio(f); }}
        className="block w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-white/10 file:text-white file:text-xs" />
      {uploading && <p className="text-xs text-gray-400">{tx('上傳中…', 'Uploading…')}</p>}
      {audioUrl && <audio controls src={audioUrl} className="w-full h-9" />}
      <div className="flex gap-2">
        <select className={`${cls} w-20`} value={currency} onChange={(e) => setCurrency(e.target.value)}>{CURRENCIES.map((c) => <option key={c} value={c} className="bg-black">{c}</option>)}</select>
        <input type="number" min="0" className={cls} value={gross} onChange={(e) => setGross(e.target.value)} placeholder={tx('你的報價', 'Your price')} />
      </div>
      <textarea className={`${cls} min-h-[48px] resize-y`} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder={tx('報價說明 + 自我介紹', 'Pricing + intro')} />
      {err && <p className="text-red-400 text-xs">{err}</p>}
      <button onClick={submit} disabled={busy || uploading || closed} className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold rounded-lg px-4 py-1.5 text-sm">{busy ? tx('送出中…', 'Submitting…') : tx('送出應徵', 'Submit')}</button>
    </div>
  );
}
