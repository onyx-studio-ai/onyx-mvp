'use client';

/*
  開通帳號中繼頁 /auth/activate?th=<token_hash> —— 專治 LINE/WhatsApp 連結預覽。
  Supabase 的 recovery 連結是「GET 即消耗」的一次性連結,貼進 LINE 時官方預覽
  爬蟲先抓一次就把 token 用掉,真人點開永遠「連結無效或已過期」(2026-07-16
  Ashley/佑芷 實際發生)。此頁載入時不動 token,等真人按下按鈕才 verifyOtp 兌換
  → 預覽爬蟲抓頁面無害。
*/

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { supabase } from '@/lib/supabase';
import { Play, Loader2, AlertCircle } from 'lucide-react';

function ActivateInner() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);
  const router = useRouter();
  const search = useSearchParams();
  const ot = search?.get('ot') || '';   // 平台自控開通碼(新;30 天、不作廢、不被爬蟲消耗)
  const th = search?.get('th') || '';   // Supabase 一次性 token(舊連結相容)
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // 自控模式:先驗開通碼 → 顯示設密碼表單
  const [otEmail, setOtEmail] = useState<string | null>(null);
  const [otName, setOtName] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [checking, setChecking] = useState(!!ot);

  useEffect(() => {
    if (!ot) return;
    fetch(`/api/auth/onboard?token=${encodeURIComponent(ot)}`)
      .then((r) => r.json()).then((j) => {
        if (j.ok && j.email) { setOtEmail(j.email); setOtName(j.name || ''); }
        else setErr(tx('連結已失效,請直接回覆 LINE/訊息跟我們說一聲,我們立刻補發新的。', '链接已失效,请直接回复 LINE/讯息跟我们说一声,我们立刻补发新的。', 'This link has expired — message us for a fresh one.'));
      }).catch(() => setErr(tx('無法驗證連結,請稍後再試或向我們索取新連結。', '无法验证链接,请稍后再试或向我们索取新链接。', 'Could not verify link — try again or ask us for a new one.')))
      .finally(() => setChecking(false));
  }, [ot]); // eslint-disable-line react-hooks/exhaustive-deps

  // 自控:設密碼 → 直接登入
  async function setPassword() {
    if (pw.length < 8) { setErr(tx('密碼至少 8 個字。', '密码至少 8 个字。', 'Password must be at least 8 characters.')); return; }
    if (pw !== pw2) { setErr(tx('兩次密碼不一致。', '两次密码不一致。', 'Passwords do not match.')); return; }
    setBusy(true); setErr('');
    const res = await fetch('/api/auth/onboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: ot, password: pw }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setBusy(false); setErr(j.error || tx('設定失敗,請稍後再試。', '设置失败,请稍后再试。', 'Failed — please try again.')); return; }
    const { error } = await supabase.auth.signInWithPassword({ email: j.email, password: pw });
    setBusy(false);
    if (error) { setErr(tx('密碼已設好,但自動登入失敗 —— 請到登入頁用此 Email 與新密碼登入。', '密码已设好,但自动登录失败 —— 请到登录页用此 Email 与新密码登录。', 'Password set, but auto sign-in failed — please sign in with your email and new password.')); return; }
    router.replace('/talent/opportunities');
  }

  // 舊連結(th):維持原 verifyOtp → reset-password
  async function activateLegacy() {
    if (!th) { setErr(tx('連結缺少參數,請向我們索取新連結。', '链接缺少参数,请向我们索取新链接。', 'This link is missing its token — please ask us for a fresh one.')); return; }
    setBusy(true); setErr('');
    const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: th });
    if (error) {
      setBusy(false);
      setErr(tx('連結已失效或過期 —— 請直接回覆 LINE/訊息跟我們說一聲,我們立刻補發新連結。', '链接已失效或过期 —— 请直接回复 LINE/讯息跟我们说一声,我们立刻补发新链接。', 'This link has expired — message us and we\'ll send a fresh one right away.'));
      return;
    }
    router.replace('/auth/reset-password');
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-400/60';

  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-2">
            <Play className="w-8 h-8 text-blue-400" />
            <span className="text-2xl font-bold text-white tracking-tight">Onyx Studios</span>
          </span>
        </div>
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 text-center space-y-5">
          <h1 className="text-white text-xl font-semibold">{tx('開通您的配音員帳號', '开通您的配音员账号', 'Activate your talent account')}</h1>

          {ot ? (
            checking ? (
              <p className="text-gray-400 text-sm inline-flex items-center gap-2 justify-center"><Loader2 className="w-4 h-4 animate-spin" />{tx('驗證連結中…', '验证链接中…', 'Verifying…')}</p>
            ) : otEmail ? (
              <>
                <p className="text-gray-400 text-sm leading-relaxed">{tx('請為', '请为', 'Set a password for')} <span className="text-white">{otName || otEmail}</span> {tx('設定登入密碼:', '设置登录密码:', '')}</p>
                <input type="password" className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} placeholder={tx('新密碼(至少 8 個字)', '新密码(至少 8 个字)', 'New password (min 8 chars)')} autoComplete="new-password" />
                <input type="password" className={inputCls} value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder={tx('再輸入一次', '再输入一次', 'Confirm password')} autoComplete="new-password"
                  onKeyDown={(e) => { if (e.key === 'Enter') setPassword(); }} />
                <button onClick={setPassword} disabled={busy}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm inline-flex items-center justify-center gap-2">
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  {busy ? tx('設定中…', '设置中…', 'Setting…') : tx('設定密碼並登入', '设置密码并登录', 'Set password & sign in')}
                </button>
              </>
            ) : null
          ) : (
            <>
              <p className="text-gray-400 text-sm leading-relaxed">{tx('按下方按鈕設定密碼,完成後即可登入後台查看您的角色與稿件。', '按下方按钮设置密码,完成后即可登录后台查看您的角色与稿件。', 'Tap the button below to set your password, then sign in to see your roles and scripts.')}</p>
              <button onClick={activateLegacy} disabled={busy}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm inline-flex items-center justify-center gap-2">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {busy ? tx('開通中…', '开通中…', 'Activating…') : tx('點我設定密碼', '点我设置密码', 'Set my password')}
              </button>
            </>
          )}

          {err && (
            <div className="flex items-start gap-2 text-left bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-red-300 text-sm">{err}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ActivatePage() {
  return <Suspense fallback={null}><ActivateInner /></Suspense>;
}
