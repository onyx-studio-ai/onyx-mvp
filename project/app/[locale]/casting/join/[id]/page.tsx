'use client';

/*
  Casting join landing (id = brief_id, shareable link). Registration is now
  MANDATORY (Wing 2026-07-21): the old accountless "type an email, audition as a
  guest" path minted orphan records with no password / no single identity. Now:
    • not logged in → prompt to register or log in (carries a ?next= back here)
    • logged in     → POST with the session token → mint/reuse a personal invite
                      tied to the talent → forward to /casting/<token> to audition
  The /casting/<token> audition UI itself is unchanged; we just gate the entrance.
*/

import { useState, useEffect, useCallback } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { langLabel } from '@/lib/languages';
import { useRouter } from '@/i18n/navigation';
import { supabase } from '@/lib/supabase';

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-black text-white px-4 pt-24 pb-16"><div className="max-w-md mx-auto">{children}</div></main>;
}

export default function CastingJoin() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const isZh = !locale.startsWith('en');
  const tx = (zh: string, en: string) => (isZh ? zh : en);

  const [phase, setPhase] = useState<'loading' | 'invalid' | 'ready'>('loading');
  const [info, setInfo] = useState<{ title?: string; language?: string; rate_note?: string; ai_type?: string; closed?: boolean } | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null); // null = 還在查
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const [res, { data }] = await Promise.all([
      fetch(`/api/casting/join?id=${encodeURIComponent(id)}`),
      supabase.auth.getSession(),
    ]);
    if (!res.ok) return setPhase('invalid');
    setInfo(await res.json().catch(() => ({})));
    setAuthed(!!data.session);
    setPhase('ready');
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // 登入者:換到試音頁(帶 session token,後端據此綁定 talent 身分)。
  async function go() {
    setErr('');
    setBusy(true);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setBusy(false); setAuthed(false); return; }
    const res = await fetch('/api/casting/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ brief_id: id }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.status === 401) { setAuthed(false); return; } // session 過期 → 回登入
    if (!res.ok || !j.token) return setErr(j.error || tx('無法進入,請稍後再試', 'Could not continue, try again'));
    router.push(`/casting/${j.token}`);
  }

  // 未登入 → 去註冊/登入,登入後回到這一頁(這頁會自動偵測 session 並讓他繼續)。
  const goAuth = (mode: 'login' | 'signup') => {
    const next = encodeURIComponent(pathname || `/casting/join/${id}`);
    router.push(`/auth?mode=${mode}&next=${next}`);
  };

  if (phase === 'loading') return <Shell><p className="text-gray-500 text-sm text-center py-20">{tx('載入中…', 'Loading…')}</p></Shell>;
  if (phase === 'invalid' || !info) return <Shell><p className="text-gray-400 text-sm text-center py-20">{tx('連結無效。', 'This link is invalid.')}</p></Shell>;

  return (
    <Shell>
      <h1 className="text-2xl font-semibold mb-1">{tx('試音邀請', 'Casting Audition')}</h1>
      {info.title && <p className="text-lg text-gray-200 mb-2">{info.title}</p>}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {info.ai_type && <span className="text-xs bg-[#6FCF97]/15 text-[#6FCF97] border border-[#6FCF97]/30 px-2 py-0.5 rounded-full">{info.ai_type === 'training' ? tx('AI 訓練素材', 'AI training') : tx('TTS / 聲音變 AI', 'TTS / voice→AI')}</span>}
        {info.language && <span className="text-xs bg-green-500/10 text-green-200 px-2 py-0.5 rounded-full">{langLabel(info.language, locale)}</span>}
        {info.rate_note && <span className="text-xs bg-amber-500/15 text-amber-200 px-2 py-0.5 rounded-full">{info.rate_note}</span>}
      </div>
      {info.ai_type && !info.closed && (
        <p className="text-xs text-[#6FCF97] bg-[#6FCF97]/[0.08] border border-[#6FCF97]/25 rounded-lg px-3 py-2 mb-4">
          {/* 措辭刻意分成「這是什麼案 → 中選才會用於訓練 → 屆時另簽授權 → 先進去看詳情」——
              舊版寫成既成事實+像要先簽約才能試音,會在門口就勸退一批人(Wing 2026-08-12)。 */}
          {info.ai_type === 'training'
            ? tx('這是一個 AI 訓練素材案。若你中選並接案,錄音將用於 AI 模型訓練(不會複製你的聲音),屆時會有一份客戶授權書需要簽署。詳細條款可先進入案件內容閱讀。', 'This is an AI training-data project. If you’re selected and take the job, the recordings will be used to train an AI model (your own voice isn’t cloned), and a client authorization document will be signed at that point. Full terms are inside the brief — have a look first.')
            : tx('這是一個 TTS / AI 語音案。若你中選並接案,錄音將用於訓練語音模型(以你的音色合成語音),屆時會有一份客戶授權書需要簽署。詳細條款可先進入案件內容閱讀。', 'This is a TTS / AI voice project. If you’re selected and take the job, the recordings will be used to train a voice model (speech synthesized in your voice), and a client authorization document will be signed at that point. Full terms are inside the brief — have a look first.')}
        </p>
      )}

      {info.closed ? (
        <p className="text-amber-300 text-sm">{tx('這個試音案已結束。', 'This casting call has closed.')}</p>
      ) : authed ? (
        <>
          <p className="text-sm text-gray-400 mb-4">{tx('你已登入,點下面就能開始試音。', 'You’re signed in — start auditioning below.')}</p>
          {err && <p className="text-red-400 text-xs mb-2">{err}</p>}
          <button onClick={go} disabled={busy} className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold rounded-lg px-4 py-2.5 text-sm">
            {busy ? tx('進入中…', 'Entering…') : tx('開始試音 →', 'Start auditioning →')}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-400 mb-4">{tx('試音需要一個帳號(帳號+密碼),資料才不會遺失、之後也方便接更多案。註冊只要一分鐘。', 'Auditioning needs an account (email + password) so nothing gets lost and future work is easy. Signing up takes a minute.')}</p>
          <button onClick={() => goAuth('signup')} className="w-full bg-green-500 hover:bg-green-400 text-black font-semibold rounded-lg px-4 py-2.5 text-sm mb-2">
            {tx('註冊並試音 →', 'Sign up & audition →')}
          </button>
          <button onClick={() => goAuth('login')} className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg px-4 py-2.5 text-sm">
            {tx('已有帳號?登入', 'Already have an account? Log in')}
          </button>
        </>
      )}
    </Shell>
  );
}
