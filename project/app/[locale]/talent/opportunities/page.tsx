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

type Brief = {
  id: string;
  brief_number: string;
  categories: string[] | null;
  content_type: string | null;
  media_scope: string | null;
  territory: string | null;
  license_term: string | null;
  script_status: string | null;
  has_singing: boolean | null;
  wants_director: boolean | null;
  wants_live_session: boolean | null;
  audition_deadline: string | null;
  language: string | null;
  length: string | null;
  budget: string | null;
  deadline: string | null;
  brief: string;
  created_at: string;
};
type Quote = {
  id: string;
  brief_id: string;
  gross_amount: number;
  net_amount: number;
  currency: string;
  status: string;
  message: string | null;
};

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

  const load = useCallback(async (accessToken: string) => {
    setToken(accessToken);
    const res = await fetch('/api/talent/briefs', { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.status === 401) return setPhase('nologin');
    const j = await res.json().catch(() => ({}));
    setBriefs(j.briefs || []);
    setQuotes(j.myQuotes || []);
    setPhase('ready');
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) await load(data.session.access_token);
      else setPhase('nologin');
    })();
  }, [load]);

  const quoteFor = (briefId: string) => quotes.find((q) => q.brief_id === briefId);

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
          <BriefCard key={b.id} brief={b} myQuote={quoteFor(b.id)} token={token} tx={tx} onQuoted={(q) => setQuotes((prev) => [q, ...prev])} />
        ))}
      </div>
    </>
  );
}

function BriefCard({
  brief,
  myQuote,
  token,
  tx,
  onQuoted,
}: {
  brief: Brief;
  myQuote?: Quote;
  token: string;
  tx: (tw: string, cn: string, en: string) => string;
  onQuoted: (q: Quote) => void;
}) {
  const [gross, setGross] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const grossN = Number(gross);
  const netPreview = isFinite(grossN) && grossN > 0 ? Math.round(grossN * (1 - COMMISSION) * 100) / 100 : 0;

  async function submit() {
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
      <div className="flex flex-wrap gap-1.5 mb-2">
        {brief.content_type && <span className="text-xs bg-amber-500/15 text-amber-200 px-2 py-0.5 rounded-full">{brief.content_type}</span>}
        {brief.has_singing && <span className="text-xs bg-pink-500/15 text-pink-200 px-2 py-0.5 rounded-full">{tx('含唱歌', '含唱歌', '+ Singing')}</span>}
        {brief.wants_live_session && <span className="text-xs bg-sky-500/15 text-sky-200 px-2 py-0.5 rounded-full">{tx('線上同步錄音', '线上同步录音', 'Live session')}</span>}
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
        {brief.budget && <span>{tx('預算', '预算', 'Budget')}: {brief.budget}</span>}
      </div>

      {myQuote ? (
        <div className="border-t border-white/10 pt-3 text-sm">
          <span className="text-green-300">
            {tx('已報價', '已报价', 'Quoted')}:{' '}
            {myQuote.currency} {myQuote.net_amount} {tx('(淨收入)', '(净收入)', '(net)')}
          </span>
          <span className="text-gray-500 ml-2">· {tx('狀態', '状态', 'Status')}: {myQuote.status}</span>
        </div>
      ) : (
        <div className="border-t border-white/10 pt-3 space-y-2">
          <div className="flex gap-2">
            <select className={`${inputCls} w-24`} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c} className="bg-black">{c}</option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              className={inputCls}
              value={gross}
              onChange={(e) => setGross(e.target.value)}
              placeholder={tx('客戶支付金額(報價)', '客户支付金额(报价)', 'Amount the client pays (your quote)')}
            />
          </div>
          {grossN > 0 && (
            <p className="text-xs text-green-300">
              {tx('您的淨收入', '您的净收入', 'Your net take-home')}: {currency} {netPreview}{' '}
              <span className="text-gray-500">({tx('已扣 20% 平台費', '已扣 20% 平台费', 'after 20% fee')})</span>
            </p>
          )}
          <textarea
            className={`${inputCls} min-h-[60px] resize-y`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={tx('附註(選填):為什麼您適合這個案子…', '附注(选填):为什么您适合这个案子…', 'Note (optional): why you fit this brief…')}
          />
          {err && <p className="text-red-400 text-xs">{err}</p>}
          <button
            onClick={submit}
            disabled={busy}
            className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold rounded-lg px-4 py-2 text-sm transition"
          >
            {busy ? tx('送出中…', '送出中…', 'Submitting…') : tx('送出報價', '送出报价', 'Submit quote')}
          </button>
        </div>
      )}
    </div>
  );
}
