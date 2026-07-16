'use client';

/*
  開通帳號中繼頁 /auth/activate?th=<token_hash> —— 專治 LINE/WhatsApp 連結預覽。
  Supabase 的 recovery 連結是「GET 即消耗」的一次性連結,貼進 LINE 時官方預覽
  爬蟲先抓一次就把 token 用掉,真人點開永遠「連結無效或已過期」(2026-07-16
  Ashley/佑芷 實際發生)。此頁載入時不動 token,等真人按下按鈕才 verifyOtp 兌換
  → 預覽爬蟲抓頁面無害。
*/

import { Suspense, useState } from 'react';
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
  const th = search?.get('th') || '';
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function activate() {
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
          <p className="text-gray-400 text-sm leading-relaxed">{tx('按下方按鈕設定密碼,完成後即可登入後台查看您的角色與稿件。', '按下方按钮设置密码,完成后即可登录后台查看您的角色与稿件。', 'Tap the button below to set your password, then sign in to see your roles and scripts.')}</p>
          <button onClick={activate} disabled={busy}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm inline-flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? tx('開通中…', '开通中…', 'Activating…') : tx('點我設定密碼', '点我设置密码', 'Set my password')}
          </button>
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
