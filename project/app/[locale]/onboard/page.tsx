'use client';

/*
  Phase 0 — post-approval onboarding (token-gated, no login).
  Validates the ?t= token, shows a welcome + the cooperation terms summary,
  and on agreement activates the talent (→ appears in the public roster).
  The formal cooperation-agreement PDF can replace the summary later.
*/

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Check, ShieldCheck } from 'lucide-react';

function OnboardInner() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);
  const token = useSearchParams().get('t') || '';

  const [state, setState] = useState<'loading' | 'invalid' | 'ready' | 'done'>('loading');
  const [name, setName] = useState('');
  const [agreeList, setAgreeList] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setState('invalid'); return; }
    fetch(`/api/talents/onboard?t=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.valid) { setState('invalid'); return; }
        setName(d.name || '');
        setState(d.done ? 'done' : 'ready');
      })
      .catch(() => setState('invalid'));
  }, [token]);

  const submit = async () => {
    setError(''); setSubmitting(true);
    try {
      const r = await fetch('/api/talents/onboard', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, agree: agreeList && agreeTerms }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || tx('開通失敗,請重試', '开通失败,请重试', 'Activation failed — please try again'));
      setState('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : tx('發生錯誤', '发生错误', 'Something went wrong'));
    } finally { setSubmitting(false); }
  };

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full">{children}</div>
    </main>
  );

  if (state === 'loading') return <Shell><p className="text-gray-500 text-sm text-center">{tx('載入中…', '加载中…', 'Loading…')}</p></Shell>;

  if (state === 'invalid') return (
    <Shell>
      <div className="text-center">
        <h1 className="text-xl font-bold mb-2">{tx('連結無效或已過期', '链接无效或已过期', 'Invalid or expired link')}</h1>
        <p className="text-gray-400 text-sm">{tx('請使用我們最新寄給您的開通連結,或直接回信與我們聯繫。', '请使用我们最新寄给您的开通链接,或直接回信与我们联系。', 'Please use the latest activation link we sent you, or reply to our email.')}</p>
      </div>
    </Shell>
  );

  if (state === 'done') return (
    <Shell>
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-amber-500 flex items-center justify-center mx-auto mb-5"><Check className="w-8 h-8 text-black" /></div>
        <h1 className="text-2xl font-bold mb-2">{tx('帳號已開通!', '账号已开通!', "You're all set!")}</h1>
        <p className="text-gray-400 text-sm leading-relaxed">{tx('歡迎加入 Onyx 配音陣容。我們已寄一封「設定密碼」的信到你的信箱 —— 設好密碼後就能登入後台,管理你的個人檔案與 demo(我們審核後才會正式上架)。沒收到信?用下方「設定 / 重設密碼」也可以。', '欢迎加入 Onyx 配音阵容。我们已发送一封「设置密码」的邮件到你的邮箱 —— 设好密码后就能登录后台,管理你的个人档案与 demo(我们审核后才会正式上架)。没收到邮件?用下方「设置 / 重设密码」也可以。', 'Welcome to the Onyx roster. We’ve emailed you a link to set your password — once set, sign in to manage your profile and demos (they go live after our review). Didn’t get the email? Use “Set / reset password” below.')}</p>
        <div className="mt-6 flex flex-col items-center gap-2">
          <Link href={`/${locale}/auth`} className="text-amber-300 text-sm font-medium hover:text-amber-200">{tx('設定 / 重設密碼 →', '设置 / 重设密码 →', 'Set / reset password →')}</Link>
          <Link href={`/${locale}/talent`} className="text-gray-500 text-sm hover:text-gray-300">{tx('前往我的後台 →', '前往我的后台 →', 'Go to my dashboard →')}</Link>
        </div>
      </div>
    </Shell>
  );

  // ready
  return (
    <Shell>
      <p className="text-xs tracking-widest text-gray-400 mb-1">{tx('ONYX · 完成報名', 'ONYX · 完成报名', 'ONYX · Complete your onboarding')}</p>
      <h1 className="text-2xl font-bold mb-1">{tx(`${name},歡迎回來`, `${name},欢迎回来`, `Welcome, ${name}`)}</h1>
      <p className="text-sm text-gray-400 mb-6">{tx('您的報名已通過審核。確認下方合作條款後,帳號即開通、進入人才庫。', '您的报名已通过审核。确认下方合作条款后,账号即开通、进入人才库。', 'Your application has been approved. Confirm the terms below to activate your account and join the roster.')}</p>

      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 mb-5">
        <p className="text-sm font-medium text-white mb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-amber-400" /> {tx('配音員合作條款', '配音员合作条款', 'Talent cooperation terms')}</p>
        <ul className="text-sm text-gray-300 space-y-2 leading-relaxed">
          <li>· {tx('聲音展示:您同意 Onyx 在平台上公開展示您的個人檔案與 demo,向客戶介紹您的聲音。', '声音展示:您同意 Onyx 在平台上公开展示您的个人档案与 demo,向客户介绍您的声音。', 'Display: you agree that Onyx may publicly show your profile and demos on the platform to present your voice to clients.')}</li>
          <li>· {tx('接案與酬勞:客戶透過平台與您成交時,您於案件完成後取得酬勞,平台就您的報價收取 20% 服務費。', '接案与酬劳:客户透过平台与您成交时,您于案件完成后取得酬劳,平台就您的报价收取 20% 服务费。', 'Jobs & pay: when a client hires you through the platform, you’re paid on completion and the platform charges a 20% service fee on your quote.')}</li>
          <li>· {tx('非獨家:本合作為非獨家,您仍可自由承接平台外的其他案件。', '非独家:本合作为非独家,您仍可自由承接平台外的其他案件。', 'Non-exclusive: you remain free to take on work outside the platform.')}</li>
          <li>· {tx('聲音權利:您聲明所上傳的聲音與 demo 為本人錄製,並擁有合法授權使用之權利。', '声音权利:您声明所上传的声音与 demo 为本人录制,并拥有合法授权使用之权利。', 'Rights: you confirm the voice and demos you upload were recorded by you and that you hold the rights to license them.')}</li>
          <li>· {tx('個案授權另簽:每一個實際案件的聲音使用、買斷、或將聲音製作為 AI 等授權,均於該案成立時另行簽署授權書。', '个案授权另签:每一个实际案件的声音使用、买断、或将声音制作为 AI 等授权,均于该案成立时另行签署授权书。', 'Per-project licences: usage, buyout, or AI-voice licences for each actual project are signed separately when that project goes ahead.')}</li>
          <li>· {tx('行為準則:遵守平台行為準則,並誠實提供資料。', '行为准则:遵守平台行为准则,并诚实提供资料。', 'Conduct: follow the platform guidelines and provide accurate information.')}</li>
        </ul>
      </div>

      <div onClick={() => setAgreeList(!agreeList)} className="flex gap-2.5 text-sm text-gray-300 mb-3 cursor-pointer">
        <div className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border ${agreeList ? 'bg-amber-500 border-amber-500' : 'border-zinc-600 bg-zinc-800'}`}>{agreeList && <Check className="w-3.5 h-3.5 text-black" />}</div>
        <span>{tx('我同意 Onyx 將我的個人檔案與 demo 上架、展示於平台,並依上述合作條款合作。', '我同意 Onyx 将我的个人档案与 demo 上架、展示于平台,并依上述合作条款合作。', 'I agree that Onyx may list and display my profile and demos on the platform, on the cooperation terms above.')}</span>
      </div>
      <div onClick={() => setAgreeTerms(!agreeTerms)} className="flex gap-2.5 text-sm text-gray-300 mb-5 cursor-pointer">
        <div className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border ${agreeTerms ? 'bg-amber-500 border-amber-500' : 'border-zinc-600 bg-zinc-800'}`}>{agreeTerms && <Check className="w-3.5 h-3.5 text-black" />}</div>
        <span onClick={(e) => e.stopPropagation()}>
          {tx('我已閱讀並同意 ', '我已阅读并同意 ', 'I have read and agree to the ')}
          <a href={`/${locale}/legal/terms`} target="_blank" className="text-amber-300 underline">{tx('服務條款', '服务条款', 'Terms of Service')}</a>
          {tx(' 與 ', ' 与 ', ' and ')}
          <a href={`/${locale}/legal/privacy`} target="_blank" className="text-amber-300 underline">{tx('隱私政策', '隐私政策', 'Privacy Policy')}</a>。
        </span>
      </div>

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
      <button type="button" disabled={!agreeList || !agreeTerms || submitting} onClick={submit}
        className="w-full py-3 rounded-xl bg-amber-500 text-black font-medium flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
        <Check className="w-4 h-4" /> {submitting ? tx('開通中…', '开通中…', 'Activating…') : tx('確認並開通帳號', '确认并开通账号', 'Confirm & activate')}
      </button>
    </Shell>
  );
}

export default function OnboardPage() {
  return <Suspense><OnboardInner /></Suspense>;
}
