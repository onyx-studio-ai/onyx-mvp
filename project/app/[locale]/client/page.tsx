'use client';

/*
  Client dashboard — a signed-in user sees the voiceover requests THEY submitted
  via /hire, with live status + an audition count, the moment they post (no waiting
  on Onyx review). Same Supabase account as the talent side, so one login surfaces
  both roles. Read-only here; selecting a talent comes later.
*/

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { caseCode } from '@/lib/casting';

type Brief = {
  id: string; brief_number: string; kind?: string | null; title?: string | null; content_type?: string | null;
  language?: string | null; status: string; budget?: string | null; budget_type?: string | null;
  media_scope?: string | null; territory?: string | null; license_term?: string | null; length?: string | null;
  audition_deadline?: string | null; deadline?: string | null;
  has_singing?: boolean | null; wants_director?: boolean | null; wants_live_session?: boolean | null;
  brief: string; created_at: string;
};

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-400/60';

export default function ClientDashboard() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  const [phase, setPhase] = useState<'loading' | 'nologin' | 'ready'>('loading');
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async (token: string) => {
    const res = await fetch('/api/client/requests', { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) return setPhase('nologin');
    const j = await res.json().catch(() => ({}));
    setBriefs(j.briefs || []);
    setCounts(j.counts || {});
    setPhase('ready');
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) await load(data.session.access_token);
      else setPhase('nologin');
    })();
  }, [load]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error || !data.session) return setErr(tx('帳號或密碼錯誤,請再試一次。', '账号或密码错误,请再试一次。', 'Incorrect email or password.'));
    setPhase('loading');
    await load(data.session.access_token);
  }

  // friendly client-facing status
  const statusInfo = (s: string, count: number): { label: string; cls: string; note: string } => {
    switch (s) {
      case 'reviewing': return { label: tx('審核中', '审核中', 'In review'), cls: 'bg-amber-500/15 text-amber-200 border-amber-500/30', note: tx('Onyx 正在確認您的需求,很快回覆。', 'Onyx 正在确认您的需求,很快回复。', 'Onyx is reviewing your request and will get back to you shortly.') };
      case 'open': return { label: tx('徵選中', '征选中', 'Auditioning'), cls: 'bg-green-500/15 text-green-200 border-green-500/30', note: count ? tx(`${count} 位配音員已試音`, `${count} 位配音员已试音`, `${count} talent(s) auditioned`) : tx('已開放配音員試音。', '已开放配音员试音。', 'Open for talent auditions.') };
      case 'awarded': return { label: tx('已選定', '已选定', 'Awarded'), cls: 'bg-sky-500/15 text-sky-200 border-sky-500/30', note: tx('已為這個案選定配音員。', '已为这个案选定配音员。', 'A talent has been selected.') };
      case 'closed': return { label: tx('已結束', '已结束', 'Closed'), cls: 'bg-white/10 text-gray-300 border-white/15', note: '' };
      case 'cancelled': return { label: tx('已取消', '已取消', 'Cancelled'), cls: 'bg-white/10 text-gray-400 border-white/15', note: '' };
      default: return { label: s, cls: 'bg-white/10 text-gray-300 border-white/15', note: '' };
    }
  };

  const shell = (inner: React.ReactNode) => (
    <main className="min-h-screen bg-black text-white px-4 pt-24 pb-16"><div className="max-w-3xl mx-auto">{inner}</div></main>
  );

  if (phase === 'loading') return shell(<p className="text-gray-500 text-sm text-center py-20">{tx('載入中…', '加载中…', 'Loading…')}</p>);

  if (phase === 'nologin') {
    return shell(
      <div className="max-w-sm mx-auto py-10">
        <h1 className="text-2xl font-semibold mb-1">{tx('我的需求', '我的需求', 'My requests')}</h1>
        <p className="text-gray-400 text-sm mb-6">{tx('登入以查看您發出的配音需求與進度。', '登录以查看您发出的配音需求与进度。', 'Sign in to view the voiceover requests you submitted and their status.')}</p>
        <form onSubmit={signIn} className="space-y-3">
          <input type="email" className={inputCls} placeholder={tx('電子郵件', '电子邮件', 'Email')} value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" className={inputCls} placeholder={tx('密碼', '密码', 'Password')} value={password} onChange={(e) => setPassword(e.target.value)} required />
          {err && <p className="text-red-400 text-xs">{err}</p>}
          <button disabled={busy} className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold rounded-lg px-4 py-2.5 text-sm">{busy ? tx('登入中…', '登录中…', 'Signing in…') : tx('登入', '登录', 'Sign in')}</button>
        </form>
        <p className="text-gray-500 text-xs mt-5 leading-relaxed">{tx('還沒發過需求?', '还没发过需求?', 'No requests yet?')} <Link href="/hire" className="text-amber-300 hover:underline">{tx('前往發案 →', '前往发案 →', 'Post a request →')}</Link></p>
      </div>
    );
  }

  return shell(
    <>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold">{tx('我的需求', '我的需求', 'My requests')}</h1>
        <div className="flex items-center gap-3 text-xs">
          <Link href="/talent" className="text-gray-400 hover:text-white transition">{tx('配音員後台 →', '配音员后台 →', 'Talent →')}</Link>
          <Link href="/hire" className="bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg px-3 py-1.5">{tx('+ 發新需求', '+ 发新需求', '+ New request')}</Link>
        </div>
      </div>
      <p className="text-gray-500 text-sm mb-8">{tx('以下是您發出的配音需求與目前進度。', '以下是您发出的配音需求与目前进度。', 'These are the requests you submitted and their current status.')}</p>

      {briefs.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-500 text-sm mb-4">{tx('您還沒有發過配音需求。', '您还没有发过配音需求。', 'You haven’t posted any requests yet.')}</p>
          <Link href="/hire" className="text-amber-300 hover:underline text-sm">{tx('前往發案 →', '前往发案 →', 'Post a request →')}</Link>
        </div>
      )}

      <div className="space-y-3">
        {briefs.map((b) => {
          const st = statusInfo(b.status, counts[b.id] || 0);
          return (
            <div key={b.id} className="bg-white/[0.02] border border-white/10 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <span className="text-xs text-gray-500 font-mono">{b.kind === 'casting' ? caseCode(b) : b.brief_number}</span>
                  <h3 className="text-lg font-semibold text-white leading-snug">{b.title || `${b.content_type || tx('配音', '配音', 'Voiceover')}${tx('需求', '需求', ' request')}`}</h3>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full border whitespace-nowrap shrink-0 ${st.cls}`}>{st.label}</span>
              </div>
              {st.note && <p className="text-xs text-gray-400 mb-2">{st.note}</p>}
              <p className="text-sm text-gray-300 whitespace-pre-wrap line-clamp-3 mb-3">{b.brief}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                {b.content_type && <span>{b.content_type}</span>}
                {b.language && <span>{b.language}</span>}
                {b.budget && <span>{tx('預算', '预算', 'Budget')} {b.budget_type ? `${b.budget_type} ` : ''}{b.budget}</span>}
                {b.audition_deadline && <span>{tx('試音截止', '试音截止', 'Audition')} {b.audition_deadline}</span>}
                {b.deadline && <span>{tx('交付截止', '交付截止', 'Delivery')} {b.deadline}</span>}
                <span>{(b.created_at || '').slice(0, 10)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
