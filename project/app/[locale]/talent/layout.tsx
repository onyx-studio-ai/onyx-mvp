'use client';

/*
  Unified talent dashboard shell: a sidebar (desktop) / top nav (mobile) that ties
  the talent's modules together — Profile, Opportunities, Earnings, Messages —
  plus a dual-role switch to the client area when the same person also orders.

  Notifications are DERIVED from real data (no notifications table): open briefs
  the talent hasn't quoted on, and quotes that progressed (shortlisted/accepted/
  awarded). They self-clear when the talent acts. Shown as a nav badge + a
  "needs your attention" banner on the home tab.

  The shell only renders once we confirm the session belongs to a talent
  (/api/talent/me 200). Otherwise it renders the page bare, so the profile page's
  own login / "not a talent" screen still works without dashboard chrome.
*/

import { useEffect, useState } from 'react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useLocale } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { User, Briefcase, MessageSquare, DollarSign, ShoppingBag, LogOut, Bell } from 'lucide-react';

export default function TalentLayout({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const isZhCN = locale === 'zh-CN';
  const isZh = locale.startsWith('zh');
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);
  const pathname = usePathname();
  const router = useRouter();

  const [name, setName] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [ready, setReady] = useState(false);
  const [isTalent, setIsTalent] = useState(false);
  const [oppCount, setOppCount] = useState(0);
  const [quoteUpdates, setQuoteUpdates] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        try {
          const r = await fetch('/api/talent/me', { headers: { Authorization: `Bearer ${token}` } });
          if (r.ok) {
            const j = await r.json();
            if (!cancelled) { setName(j.talent?.name || ''); setIsClient(!!j.isClient); setIsTalent(true); }
            // Derive notifications from the briefs feed (real data, no extra table).
            try {
              const br = await fetch('/api/talent/briefs', { headers: { Authorization: `Bearer ${token}` } });
              if (br.ok) {
                const bj = await br.json();
                const quoted = new Set((bj.myQuotes || []).map((q: { brief_id: string }) => q.brief_id));
                const opps = (bj.briefs || []).filter((b: { id: string }) => !quoted.has(b.id)).length;
                const upd = (bj.myQuotes || []).filter((q: { status: string }) => ['shortlisted', 'accepted', 'awarded'].includes(q.status)).length;
                if (!cancelled) { setOppCount(opps); setQuoteUpdates(upd); }
              }
            } catch { /* notifications are best-effort */ }
          }
        } catch { /* not a talent — render bare */ }
      }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!ready || !isTalent) return <>{children}</>;

  const nav = [
    { href: '/talent', label: tx('我的檔案', '我的资料', 'Profile'), icon: User, exact: true, badge: 0 },
    { href: '/talent/opportunities', label: tx('案件機會', '案件机会', 'Opportunities'), icon: Briefcase, badge: oppCount },
    { href: '/talent/earnings', label: tx('收款', '收款', 'Earnings'), icon: DollarSign, badge: 0 },
    { href: '/messages', label: tx('訊息', '消息', 'Messages'), icon: MessageSquare, badge: 0 },
  ];
  const active = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));
  const signOut = async () => { await supabase.auth.signOut(); router.push('/auth'); };

  const Badge = ({ n }: { n: number }) => (n > 0 ? <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">{n}</span> : null);
  const showBanner = pathname === '/talent' && (oppCount > 0 || quoteUpdates > 0);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-56 border-r border-white/10 bg-zinc-950 p-4 z-30">
        <div className="px-2 py-3 mb-2">
          <p className="text-[11px] tracking-[0.25em] text-amber-300">ONYX</p>
          <p className="text-sm font-semibold mt-1 truncate">{name || tx('配音員', '配音员', 'Talent')}</p>
          <p className="text-[11px] text-gray-500">{tx('配音員後台', '配音员后台', 'Talent dashboard')}</p>
        </div>
        <nav className="flex-1 space-y-1">
          {nav.map((n) => {
            const A = active(n.href, n.exact); const I = n.icon;
            return (
              <Link key={n.href} href={n.href} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${A ? 'bg-amber-500/15 text-amber-200' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                <I className="w-4 h-4" /> {n.label} <Badge n={n.badge} />
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 pt-2 border-t border-white/10">
          {isClient && (
            <Link href="/dashboard" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5">
              <ShoppingBag className="w-4 h-4" /> {tx('客戶後台', '客户后台', 'Client area')}
            </Link>
          )}
          <button onClick={signOut} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5">
            <LogOut className="w-4 h-4" /> {tx('登出', '登出', 'Sign out')}
          </button>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="md:hidden sticky top-0 z-30 bg-zinc-950 border-b border-white/10 overflow-x-auto">
        <div className="flex items-center gap-1.5 px-3 py-2 whitespace-nowrap">
          {nav.map((n) => {
            const A = active(n.href, n.exact);
            return (
              <Link key={n.href} href={n.href} className={`px-3 py-1.5 rounded-full text-xs inline-flex items-center gap-1 ${A ? 'bg-amber-500 text-black' : 'bg-white/5 text-gray-300'}`}>
                {n.label}{n.badge > 0 && <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">{n.badge}</span>}
              </Link>
            );
          })}
          {isClient && <Link href="/dashboard" className="px-3 py-1.5 rounded-full text-xs bg-white/5 text-gray-300">{tx('客戶', '客户', 'Client')}</Link>}
          <button onClick={signOut} className="px-3 py-1.5 rounded-full text-xs bg-white/5 text-gray-300">{tx('登出', '登出', 'Sign out')}</button>
        </div>
      </div>

      <div className="md:pl-56">
        {showBanner && (
          <div className="px-4 pt-4 md:pt-6">
            <div className="max-w-3xl mx-auto rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3 flex items-center gap-3 text-sm">
              <Bell className="w-4 h-4 text-amber-300 flex-shrink-0" />
              <span className="text-gray-200">
                {oppCount > 0 && <Link href="/talent/opportunities" className="text-amber-300 hover:text-amber-200 font-medium">{tx(`${oppCount} 個新案件機會`, `${oppCount} 个新案件机会`, `${oppCount} new ${oppCount === 1 ? 'opportunity' : 'opportunities'}`)}</Link>}
                {oppCount > 0 && quoteUpdates > 0 && <span className="text-gray-500"> · </span>}
                {quoteUpdates > 0 && <Link href="/talent/opportunities" className="text-amber-300 hover:text-amber-200 font-medium">{tx(`${quoteUpdates} 個報價有進展`, `${quoteUpdates} 个报价有进展`, `${quoteUpdates} quote ${quoteUpdates === 1 ? 'update' : 'updates'}`)}</Link>}
                <span className="text-gray-400">{tx(' — 需要你看一下', ' — 需要你看一下', ' need your attention')}</span>
              </span>
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
