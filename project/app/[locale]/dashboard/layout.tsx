'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { FileAudio, Settings, LogOut, Receipt, ClipboardList, User, Briefcase, DollarSign, MessageSquare, Info, ArrowRight, ArrowLeftRight } from 'lucide-react';
import { DashboardProvider, useDashboardUser } from '@/contexts/DashboardContext';
import { supabase } from '@/lib/supabase';

function DashboardHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('dashboard');
  const tr = (key: string, fallback: string) => {
    const value = t(key as any);
    return value === `dashboard.${key}` ? fallback : value;
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  // Mirror the 4 service modules from the marketing-side Navbar so the
  // dashboard top nav reads as the same taxonomy users saw before sign-in.
  // Wing 2026-06-07: 影片工作室 + 數據工作室 were missing — restored.
  const mainLinks = [
    { href: '/voice', label: tr('navVoiceStudio', '配音工作室') },
    { href: '/music', label: tr('navMusicStudio', '音樂工作室') },
    { href: '/dubbing', label: tr('navDubbingStudio', '影片工作室') },
    { href: '/data', label: tr('navDataStudio', '數據工作室') },
    { href: '/contact', label: tr('navContact', '聯絡我們') },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-[#050505] border-b border-white/[0.06] z-40 flex items-center px-6">
      <Link href="/" className="flex items-center flex-shrink-0">
        <img
          src="/logo-horizontal-white.svg"
          alt="Onyx Studios"
          className="h-9 w-auto opacity-80 hover:opacity-100 transition-opacity"
        />
      </Link>

      <div className="flex-1" />

      <nav className="hidden md:flex items-center gap-6">
        {mainLinks.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            {label}
          </Link>
        ))}
        <Link
          href="/dashboard"
          className={`text-sm font-medium px-4 py-1.5 rounded-lg transition-colors ${
            pathname?.includes('/dashboard')
              ? 'bg-white/10 text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          {tr('navDashboard', '控制台')}
        </Link>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          {tr('navSignOut', '登出')}
        </button>
      </nav>
    </header>
  );
}

function Sidebar({ showTalentLink, headshot }: { showTalentLink: boolean; headshot: string }) {
  const pathname = usePathname();
  const safePathname = pathname || '';
  const user = useDashboardUser();
  const locale = useLocale();
  const isZhCN = locale === 'zh-CN';
  const isZh = locale.startsWith('zh');
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);
  const t = useTranslations('dashboard');
  const tr = (key: string, fallback: string) => {
    const value = t(key as any);
    return value === `dashboard.${key}` ? fallback : value;
  };

  // Unified sidebar: same two groups as the talent dashboard, so switching between
  // /talent/* and /dashboard/* keeps the SAME sidebar (no "jumped to another page"
  // feeling). 配音員 group shows only for dual-role accounts.
  const talentNav = [
    { href: '/talent', label: tr('navTalentProfile', '我的檔案'), icon: User },
    { href: '/talent/opportunities', label: tr('navTalentOpps', '案件機會'), icon: Briefcase },
    { href: '/talent/earnings', label: tr('navTalentEarnings', '收款'), icon: DollarSign },
    { href: '/talent/messages', label: tr('navTalentMessages', '訊息'), icon: MessageSquare },
  ];
  const clientNav = [
    { href: '/dashboard', label: tr('navProjects', '專案'), icon: FileAudio },
    { href: '/dashboard/requests', label: tr('navRequests', '配音需求'), icon: ClipboardList },
    { href: '/dashboard/invoices', label: tr('navInvoices', '發票'), icon: Receipt },
    { href: '/dashboard/messages', label: tr('navClientMessages', '訊息'), icon: MessageSquare },
  ];
  const isActive = (href: string) =>
    href === '/dashboard' ? (safePathname === '/dashboard' || safePathname.startsWith('/dashboard/orders'))
      : href === '/talent' ? safePathname === '/talent'
        : safePathname === href || safePathname.startsWith(href + '/');
  const itemCls = (active: boolean) => `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${active ? 'bg-amber-500/15 text-amber-200' : 'text-gray-400 hover:text-white hover:bg-white/5'}`;
  const displayName = user.user_metadata?.full_name || user.email;

  return (
    <aside className="hidden md:flex w-56 flex-col fixed top-16 bottom-0 border-r border-white/10 bg-zinc-950 z-30">
      {/* 身分區 — 與配音員後台側邊欄頂部共用同一套結構(頭像 / 名字 / 當前後台)。
          雙重身分時,底部再放一顆明確的「前往配音員後台」切換鈕,切換時視覺連貫。 */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-[10px] tracking-[0.25em] text-amber-300 mb-2 px-2">ONYX</p>
        <div className="flex items-center gap-2.5 px-2">
          {headshot
            ? <img src={headshot} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
            : <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0"><User className="w-4 h-4 text-gray-400" /></span>}
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{displayName}</p>
            <p className="text-[11px] text-gray-500">{tx('客戶後台', '客户后台', 'Client dashboard')}</p>
          </div>
        </div>
        {showTalentLink && (
          <Link href="/talent" className="mt-3 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-gray-300 bg-white/5 hover:bg-white/10 hover:text-white transition-colors">
            <ArrowLeftRight className="w-3.5 h-3.5" /> {tx('前往配音員後台', '前往配音员后台', 'Switch to talent')}
          </Link>
        )}
      </div>
      <nav className="flex-1 p-4 space-y-1 pt-2 overflow-y-auto">
        {showTalentLink && (
          <>
            <p className="px-3 pb-1 text-[10px] uppercase tracking-[0.2em] text-gray-500">{tr('groupTalent', '配音員')}</p>
            {talentNav.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={itemCls(isActive(href))}><Icon className="w-4 h-4" />{label}</Link>
            ))}
          </>
        )}
        <div className={showTalentLink ? 'pt-3 mt-3 border-t border-white/10' : ''}>
          <p className="px-3 pb-1 text-[10px] uppercase tracking-[0.2em] text-gray-500">{tr('groupClient', '客戶')}</p>
          {clientNav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={itemCls(isActive(href))}><Icon className="w-4 h-4" />{label}</Link>
          ))}
        </div>
      </nav>

      <div className="p-4 border-t border-white/10">
        {/* 登出走全站頂部 header,這裡只放設定,避免同頁兩顆登出鈕。 */}
        <Link href="/dashboard/settings" className={itemCls(isActive('/dashboard/settings'))}><Settings className="w-4 h-4" />{tr('navSettings', '設定')}</Link>
      </div>
    </aside>
  );
}

function MobileNav({ showTalentLink }: { showTalentLink: boolean }) {
  const pathname = usePathname();
  const safePathname = pathname || '';
  const t = useTranslations('dashboard');
  const tr = (key: string, fallback: string) => {
    const value = t(key as any);
    return value === `dashboard.${key}` ? fallback : value;
  };
  const nav = [
    ...(showTalentLink ? [
      { href: '/talent', label: tr('navTalentProfile', '我的檔案') },
      { href: '/talent/opportunities', label: tr('navTalentOpps', '案件機會') },
      { href: '/talent/earnings', label: tr('navTalentEarnings', '收款') },
      { href: '/talent/messages', label: tr('navTalentMessages', '訊息') },
    ] : []),
    { href: '/dashboard', label: tr('navProjects', '專案') },
    { href: '/dashboard/requests', label: tr('navRequests', '配音需求') },
    { href: '/dashboard/invoices', label: tr('navInvoices', '發票') },
    { href: '/dashboard/settings', label: tr('navSettings', '設定') },
  ];

  return (
    <div className="md:hidden flex items-center gap-1 px-4 py-2.5 border-b border-white/[0.06] bg-[#080808] overflow-x-auto whitespace-nowrap">
      {nav.map(({ href, label }) => {
        const active =
          href === '/dashboard'
            ? safePathname === '/dashboard' || safePathname.startsWith('/dashboard/orders')
            : safePathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              active ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const isZhCN = locale === 'zh-CN';
  const isZh = locale.startsWith('zh');
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  // 進客戶後台的三種身分:
  //   純客戶(有下單、沒配音檔)          → 留下,不顯示配音員切換
  //   雙重身分(既是配音員又下過單)      → 留下,顯示「配音員 ⇄ 客戶」切換
  //   純配音員(有配音檔、從沒下過單)    → 留下(不再強制踢走),頂部顯示溫和引導條
  // 關鍵:客戶後台對任何登入者都「進得去」,絕不 router.replace 把人鎖在外面
  // ——即使 /api/talent/me 因網路/RLS 偶發誤判,也只是少顯示一個提示條,不影響存取。
  // /api/talent/me 回 { talent, isClient }:ok ⇒ 有配音員檔;isClient ⇒ 也是客戶。
  const [showTalentLink, setShowTalentLink] = useState(false);
  const [pureTalent, setPureTalent] = useState(false); // 有配音員檔但從沒下過單
  const [headshot, setHeadshot] = useState(''); // 有配音員檔時,頂部身分區用的頭像
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const tok = session?.access_token;
        if (!tok) return;
        const r = await fetch('/api/talent/me', { headers: { Authorization: `Bearer ${tok}` } });
        if (!r.ok) return; // 非配音員(404)→ 純客戶,留下、不顯示切換
        const { isClient, talent } = await r.json().catch(() => ({ isClient: false, talent: null }));
        if (!active) return;
        if (talent?.headshot_url) setHeadshot(talent.headshot_url);
        if (isClient) {
          setShowTalentLink(true); // 雙重身分 → 顯示切換
        } else {
          setPureTalent(true); // 純配音員 → 留下,顯示溫和引導條(不自動跳)
        }
      } catch { /* 網路問題 → 什麼都不做,留在客戶後台 */ }
    })();
    return () => { active = false; };
  }, []);

  return (
    <DashboardProvider>
      <div className="min-h-screen bg-[#050505]">
        <DashboardHeader />
        <Sidebar showTalentLink={showTalentLink} headshot={headshot} />
        <div className="md:ml-56 pt-16 min-h-screen">
          <MobileNav showTalentLink={showTalentLink} />
          {pureTalent && (
            // 純配音員誤入客戶後台:溫和提示 + 一鍵前往配音員後台,但不強制導向,
            // 讓他仍可留在這裡(例如他正想以客戶身分下第一筆單)。
            <div className="px-4 pt-4 md:px-6">
              <div className="max-w-3xl rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3 flex items-center gap-3 text-sm">
                <Info className="w-4 h-4 text-amber-300 flex-shrink-0" />
                <span className="text-gray-200 flex-1">
                  {tx('這是客戶後台。你的配音員後台在另一邊。', '这是客户后台。你的配音员后台在另一边。', 'This is the client dashboard. Your talent dashboard is on the other side.')}
                </span>
                <Link
                  href="/talent"
                  className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 font-medium whitespace-nowrap"
                >
                  {tx('前往配音員後台', '前往配音员后台', 'Go to talent dashboard')}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
          {children}
        </div>
      </div>
    </DashboardProvider>
  );
}
