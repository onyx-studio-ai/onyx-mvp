'use client';

/*
  Public self-serve casting join landing (no login). The shared link carries the
  casting call's id. The visitor enters name + email → we mint their personal
  invite token → forward them to the normal guest audition page (/casting/<token>)
  where they audition without registering and can upgrade to a full account later.
*/

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

const cls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-400/60';

// Module-level so it isn't re-created every render — a component defined inside
// the render remounts its children on each keystroke (mobile keyboard drops focus).
function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-black text-white px-4 pt-24 pb-16"><div className="max-w-md mx-auto">{children}</div></main>;
}

export default function CastingJoin() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const locale = useLocale();
  const isZh = !locale.startsWith('en');
  const tx = (zh: string, en: string) => (isZh ? zh : en);

  const [phase, setPhase] = useState<'loading' | 'invalid' | 'ready'>('loading');
  const [info, setInfo] = useState<{ title?: string; language?: string; rate_note?: string; ai_type?: string; closed?: boolean } | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/casting/join?id=${encodeURIComponent(id)}`);
    if (!res.ok) return setPhase('invalid');
    setInfo(await res.json().catch(() => ({})));
    setPhase('ready');
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function go() {
    setErr('');
    if (!email.trim()) return setErr(tx('請填 email', 'Enter your email'));
    setBusy(true);
    const res = await fetch('/api/casting/join', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief_id: id, email: email.trim(), name: name.trim() }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !j.token) return setErr(j.error || tx('無法進入,請稍後再試', 'Could not continue, try again'));
    router.push(`/casting/${j.token}`);
  }

  if (phase === 'loading') return <Shell><p className="text-gray-500 text-sm text-center py-20">{tx('載入中…', 'Loading…')}</p></Shell>;
  if (phase === 'invalid' || !info) return <Shell><p className="text-gray-400 text-sm text-center py-20">{tx('連結無效。', 'This link is invalid.')}</p></Shell>;

  return (
    <Shell>
      <h1 className="text-2xl font-semibold mb-1">{tx('試音邀請', 'Casting Audition')}</h1>
      {info.title && <p className="text-lg text-gray-200 mb-2">{info.title}</p>}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {info.ai_type && <span className="text-xs bg-[#6FCF97]/15 text-[#6FCF97] border border-[#6FCF97]/30 px-2 py-0.5 rounded-full">{info.ai_type === 'training' ? tx('AI 訓練素材', 'AI training') : tx('TTS / 聲音變 AI', 'TTS / voice→AI')}</span>}
        {info.language && <span className="text-xs bg-green-500/10 text-green-200 px-2 py-0.5 rounded-full">{info.language}</span>}
        {info.rate_note && <span className="text-xs bg-amber-500/15 text-amber-200 px-2 py-0.5 rounded-full">{info.rate_note}</span>}
      </div>
      {info.ai_type && !info.closed && (
        <p className="text-xs text-[#6FCF97] bg-[#6FCF97]/[0.08] border border-[#6FCF97]/25 rounded-lg px-3 py-2 mb-4">
          {info.ai_type === 'training'
            ? tx('這是一個 AI 訓練素材案 —— 錄音會用於訓練 AI(不會複製你的聲音)。接案後將另簽客戶的授權書。', 'This is an AI training-data project — recordings train an AI (your own voice isn’t cloned). You’ll sign the client’s authorization if you take it.')
            : tx('這是一個 TTS / AI 語音案 —— 你的錄音會被製成 AI 語音模型(用你的音色合成語音)。接案後將另簽客戶的授權書。', 'This is a TTS / AI voice project — your recordings become an AI voice model (your voice, synthesized). You’ll sign the client’s authorization if you take it.')}
        </p>
      )}

      {info.closed ? (
        <p className="text-amber-300 text-sm">{tx('這個試音案已結束。', 'This casting call has closed.')}</p>
      ) : (
        <>
          <p className="text-sm text-gray-400 mb-4">{tx('填一下基本資料就能直接試音 —— 免註冊、免密碼。之後想成為正式配音員也可以,資料不會遺失。', 'Just your basics to start auditioning — no sign-up, no password. You can become a full talent later; nothing is lost.')}</p>
          <label className="block mb-2">
            <span className="text-xs text-gray-400 mb-1 block">{tx('稱呼 / 藝名', 'Name')}</span>
            <input className={cls} value={name} onChange={(e) => setName(e.target.value)} placeholder={tx('你的名字', 'Your name')} />
          </label>
          <label className="block mb-3">
            <span className="text-xs text-gray-400 mb-1 block">Email *</span>
            <input className={cls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
              onKeyDown={(e) => { if (e.key === 'Enter') go(); }} />
          </label>
          {err && <p className="text-red-400 text-xs mb-2">{err}</p>}
          <button onClick={go} disabled={busy} className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold rounded-lg px-4 py-2.5 text-sm">
            {busy ? tx('進入中…', 'Entering…') : tx('開始試音 →', 'Start auditioning →')}
          </button>
        </>
      )}
    </Shell>
  );
}
