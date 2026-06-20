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
  const [agree, setAgree] = useState(false);
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
        body: JSON.stringify({ token, agree }),
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
        <p className="text-gray-400 text-sm leading-relaxed">{tx('歡迎正式加入 Onyx 配音陣容。有合適的案子我們會主動通知您。', '欢迎正式加入 Onyx 配音阵容。有合适的案子我们会主动通知您。', 'Welcome to the Onyx voice roster. We’ll reach out when a fitting job comes up.')}</p>
        <Link href={`/${locale}/talents`} className="inline-block mt-5 text-amber-300 text-sm hover:text-amber-200">{tx('看看配音陣容 →', '看看配音阵容 →', 'Browse the roster →')}</Link>
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
          <li>· {tx('接案完成後取得酬勞,平台收取 20% 服務費。', '接案完成后取得酬劳,平台收取 20% 服务费。', 'You’re paid on completion; the platform retains a 20% service fee.')}</li>
          <li>· {tx('合作為非獨家 —— 您仍可自由承接其他案件。', '合作为非独家 —— 您仍可自由承接其他案件。', 'Non-exclusive — you remain free to take on other work.')}</li>
          <li>· {tx('遵守平台行為準則,聲音為本人所有並有權授權使用。', '遵守平台行为准则,声音为本人所有并有权授权使用。', 'You follow the conduct guidelines and own / hold the rights to your voice.')}</li>
          <li>· {tx('買斷或 AI 聲音等授權,於實際合作時另行簽署。', '买断或 AI 声音等授权,于实际合作时另行签署。', 'Buyout or AI-voice licences are signed separately, only when a project goes ahead.')}</li>
        </ul>
      </div>

      <div onClick={() => setAgree(!agree)} className="flex gap-2.5 text-sm text-gray-300 mb-5 cursor-pointer">
        <div className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border ${agree ? 'bg-amber-500 border-amber-500' : 'border-zinc-600 bg-zinc-800'}`}>{agree && <Check className="w-3.5 h-3.5 text-black" />}</div>
        <span onClick={(e) => e.stopPropagation()}>
          {tx('本人已閱讀並同意上述合作條款與 ', '本人已阅读并同意上述合作条款与 ', 'I have read and agree to the cooperation terms and ')}
          <a href={`/${locale}/legal/terms`} target="_blank" className="text-amber-300 underline">{tx('平台條款', '平台条款', 'Platform Terms')}</a>。
        </span>
      </div>

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
      <button type="button" disabled={!agree || submitting} onClick={submit}
        className="w-full py-3 rounded-xl bg-amber-500 text-black font-medium flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
        <Check className="w-4 h-4" /> {submitting ? tx('開通中…', '开通中…', 'Activating…') : tx('確認並開通帳號', '确认并开通账号', 'Confirm & activate')}
      </button>
    </Shell>
  );
}

export default function OnboardPage() {
  return <Suspense><OnboardInner /></Suspense>;
}
