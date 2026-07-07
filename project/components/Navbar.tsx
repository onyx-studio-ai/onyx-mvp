'use client';

import { useState, useEffect } from 'react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { Menu, X, LogOut, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { useTranslations, useLocale } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const t = useTranslations('navbar');
  const tc = useTranslations('common');
  const locale = useLocale();
  const isZhCN = locale === 'zh-CN';
  const isZh = locale.startsWith('zh');
  const ntx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  // 「控制台」按鈕該去哪:純配音員→/talent,純客戶/雙重身分/未知→/dashboard。
  // 預設 /dashboard,避免身分查出來前先閃到別處(客戶/雙重身分本來就進 /dashboard)。
  const [dashboardHref, setDashboardHref] = useState<'/talent' | '/dashboard'>('/dashboard');

  useEffect(() => {
    let active = true;

    // 依登入身分解析「控制台」目的地:只有「有 talent 檔且非客戶」的純配音員
    // 導去 /talent;查不出(未登入 / 非配音員 / 網路問題)一律留在預設 /dashboard。
    const resolveDashboardHref = async (token: string) => {
      try {
        const meRes = await fetch('/api/talent/me', { headers: { Authorization: `Bearer ${token}` } });
        if (!active) return;
        if (meRes.ok) {
          const { isClient } = await meRes.json().catch(() => ({ isClient: false }));
          setDashboardHref(isClient ? '/dashboard' : '/talent');
        } else {
          setDashboardHref('/dashboard'); // 非配音員(404)→ 純客戶,進 /dashboard
        }
      } catch { /* 網路問題 → 維持預設 /dashboard */ }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      setUser(session?.user ?? null);
      const tok = session?.access_token;
      if (tok) resolveDashboardHref(tok);
      else setDashboardHref('/dashboard');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      const tok = session?.access_token;
      if (tok) resolveDashboardHref(tok);
      else setDashboardHref('/dashboard'); // 登出後重置
    });

    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push('/');
  };

  const isDashboard = pathname?.startsWith('/dashboard') || pathname?.startsWith('/admin');

  const isVoiceContext = pathname?.startsWith('/voice') || pathname === '/voices' || pathname === '/pricing';
  const isMusicContext = pathname?.startsWith('/music');
  const isDubbingContext = pathname?.startsWith('/dubbing');
  const isDataContext = pathname?.startsWith('/data');
  const isPartnerContext = pathname?.startsWith('/apply');
  const isHireContext = pathname?.startsWith('/hire');
  const isLobby = pathname === '/';

  // 4 service modules — mirrors the 4 service cards on the homepage so the
  // top nav reads as the canonical service taxonomy. Partner Network is
  // separate (right-side, secondary) — it's supply-side recruitment, not a
  // service to clients, so it doesn't belong in the service-module row.
  const visibleModules = [
    { href: '/voice' as const, label: t('voiceStudio') },
    { href: '/music' as const, label: t('musicStudio') },
    { href: '/dubbing' as const, label: t('dubbingStudio') },
    { href: '/data' as const, label: t('dataStudio') },
  ];

  type ContextTool = { label: string; href?: string; children?: { href: string; label: string }[] };
  const getContextTools = (): ContextTool[] => {
    if (isVoiceContext) {
      // One "Browse voices" item that forks into AI vs real-human (keeps the
      // top nav short instead of two separate entries).
      return [
        {
          label: ntx('瀏覽聲音', '浏览声音', 'Browse voices'),
          children: [
            { href: '/voices', label: ntx('AI 聲音', 'AI 声音', 'AI Voices') },
            { href: '/talents', label: ntx('真人配音員', '真人配音员', 'Human Talent') },
          ],
        },
        { href: '/pricing', label: t('pricing') },
      ];
    }

    if (isMusicContext) {
      // 'Catalog' (Singer roster) removed pending real verified singers —
      // see /music/talents/page.tsx for context. Re-add when ready.
      return [
        { href: '/music/pricing', label: t('pricing') },
        { href: '/music/orchestra', label: t('liveStrings') },
      ];
    }

    return [];
  };

  const contextTools = getContextTools();
  const showTools = isVoiceContext || isMusicContext;

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Early return AFTER all hooks are declared (Rules of Hooks).
  // The dashboard / admin areas have their own headers and don't want
  // the public navbar — but we must keep hook order consistent across
  // every route, otherwise React #310 fires when the user navigates
  // between public pages (8 hooks) and dashboard pages (would be 7).
  if (isDashboard) return null;

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-24">
            <Link href="/" className="flex items-center">
              <img
                src="/logo-horizontal-white.svg"
                alt="Onyx Studios"
                className="h-[80px] w-auto"
              />
            </Link>

            <div className="hidden md:flex items-center gap-8">
              {visibleModules.map((module) => {
                let isActive = false;

                if (module.href === '/voice' && isVoiceContext) {
                  isActive = true;
                }

                if (module.href === '/music' && isMusicContext) {
                  isActive = true;
                }

                if (module.href === '/dubbing' && isDubbingContext) {
                  isActive = true;
                }

                if (module.href === '/data' && isDataContext) {
                  isActive = true;
                }

                return (
                  <Link
                    key={module.href}
                    href={module.href}
                    className={`text-sm font-medium transition-colors relative ${
                      isActive
                        ? 'text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {module.label}
                    {isActive && (
                      <div className="absolute -bottom-[37px] left-0 right-0 h-[2px] bg-blue-500" />
                    )}
                  </Link>
                );
              })}

              {showTools && (
                <>
                  <div className="h-6 w-[1px] bg-white/20" />

                  {contextTools.map((tool) => {
                    if (tool.children) {
                      const childActive = tool.children.some((c) => pathname === c.href);
                      return (
                        <div key={tool.label} className="relative group">
                          <button
                            className={`text-sm font-medium transition-colors relative flex items-center gap-1 ${childActive ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                          >
                            {tool.label}
                            <ChevronDown className="w-3.5 h-3.5" />
                            {childActive && (
                              <div className="absolute -bottom-[37px] left-0 right-0 h-[2px] bg-blue-500" />
                            )}
                          </button>
                          {/* pt-3 keeps the hover bridge so the panel doesn't vanish on the gap */}
                          <div className="absolute left-0 top-full pt-3 hidden group-hover:block z-50">
                            <div className="bg-zinc-900 border border-white/10 rounded-lg py-1 min-w-[150px] shadow-xl">
                              {tool.children.map((c) => (
                                <Link
                                  key={c.href}
                                  href={c.href}
                                  className={`block px-4 py-2 text-sm transition-colors ${pathname === c.href ? 'text-white bg-white/5' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
                                >
                                  {c.label}
                                </Link>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    const isActive = pathname === tool.href;
                    return (
                      <Link
                        key={tool.href}
                        href={tool.href!}
                        className={`text-sm font-medium transition-colors relative ${
                          isActive
                            ? 'text-white'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {tool.label}
                        {isActive && (
                          <div className="absolute -bottom-[37px] left-0 right-0 h-[2px] bg-blue-500" />
                        )}
                      </Link>
                    );
                  })}
                </>
              )}

              {/* 發案 — client-facing direct action to the brief form (/hire).
                  Sits ahead of Partner Network (supply-side) so the demand-side
                  CTA reads first. */}
              <Link
                href="/hire"
                className={`text-sm font-medium transition-colors relative ${
                  isHireContext
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {ntx('發案', '发案', 'Post a brief')}
                {isHireContext && (
                  <div className="absolute -bottom-[37px] left-0 right-0 h-[2px] bg-blue-500" />
                )}
              </Link>

              {/* Partner Network — supply-side recruitment entry. Sits in
                  the secondary nav (right of the 4 service modules) because
                  it's not a service; it's where talents / studios / directors
                  / proofreaders apply to join. */}
              <Link
                href="/apply"
                className={`text-sm font-medium transition-colors relative ${
                  isPartnerContext
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {t('partnerNetwork')}
                {isPartnerContext && (
                  <div className="absolute -bottom-[37px] left-0 right-0 h-[2px] bg-blue-500" />
                )}
              </Link>

              <Link
                href="/contact"
                className={`text-sm font-medium transition-colors relative ${
                  pathname === '/contact'
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {t('contact')}
                {pathname === '/contact' && (
                  <div className="absolute -bottom-[37px] left-0 right-0 h-[2px] bg-blue-500" />
                )}
              </Link>

              <LanguageSwitcher />

              {user ? (
                <div className="flex items-center gap-3 ml-2">
                  <Link
                    href={dashboardHref}
                    className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                      pathname === dashboardHref
                        ? 'bg-blue-600 text-white'
                        : 'bg-white/10 text-white hover:bg-white/15'
                    }`}
                  >
                    {tc('dashboard')}
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                    title={tc('signOut')}
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <Link
                  href="/auth"
                  className="text-sm font-medium px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors ml-2"
                >
                  {tc('signIn')}
                </Link>
              )}
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
              aria-label={t('toggleMobileMenu')}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </nav>

      <div
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden ${
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeMobileMenu}
      />

      <div
        className={`fixed top-0 right-0 bottom-0 w-64 overflow-y-auto overscroll-contain bg-gradient-to-b from-black via-gray-950 to-black border-l border-white/10 z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full pt-20 px-6">
          <div className="flex flex-col gap-6">
              {visibleModules.map((module) => {
              let isActive = false;

              if (module.href === '/voice' && isVoiceContext) {
                isActive = true;
              }

              if (module.href === '/music' && isMusicContext) {
                isActive = true;
              }

              if (module.href === '/dubbing' && isDubbingContext) {
                isActive = true;
              }

              if (module.href === '/data' && isDataContext) {
                isActive = true;
              }

              return (
                <Link
                  key={module.href}
                  href={module.href}
                  onClick={() => closeMobileMenu()}
                  className={`text-lg font-medium transition-colors ${
                    isActive
                      ? 'text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {module.label}
                  {isActive && (
                    <div className="mt-2 h-[2px] w-12 bg-blue-500" />
                  )}
                </Link>
              );
            })}

            {showTools && (
              <>
                <div className="h-[1px] w-full bg-white/10 my-2" />

                {contextTools.map((tool) => {
                  const links = tool.children ?? [{ href: tool.href!, label: tool.label }];
                  return links.map((c) => {
                    const isActive = pathname === c.href;
                    return (
                      <Link
                        key={c.href}
                        href={c.href}
                        onClick={() => closeMobileMenu()}
                        className={`text-lg font-medium transition-colors ${
                          isActive
                            ? 'text-white'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {c.label}
                        {isActive && (
                          <div className="mt-2 h-[2px] w-12 bg-blue-500" />
                        )}
                      </Link>
                    );
                  });
                })}
              </>
            )}

            <div className="h-[1px] w-full bg-white/10 my-2" />

            <Link
              href="/hire"
              onClick={() => closeMobileMenu()}
              className={`text-lg font-medium transition-colors ${
                isHireContext
                  ? 'text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {ntx('發案', '发案', 'Post a brief')}
              {isHireContext && (
                <div className="mt-2 h-[2px] w-12 bg-blue-500" />
              )}
            </Link>

            <Link
              href="/apply"
              onClick={() => closeMobileMenu()}
              className={`text-lg font-medium transition-colors ${
                isPartnerContext
                  ? 'text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t('partnerNetwork')}
              {isPartnerContext && (
                <div className="mt-2 h-[2px] w-12 bg-blue-500" />
              )}
            </Link>

            <Link
              href="/contact"
              onClick={() => closeMobileMenu()}
              className={`text-lg font-medium transition-colors ${
                pathname === '/contact'
                  ? 'text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t('contact')}
              {pathname === '/contact' && (
                <div className="mt-2 h-[2px] w-12 bg-blue-500" />
              )}
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10">
            {user ? (
              <div className="flex flex-col gap-3">
                <Link
                  href={dashboardHref}
                  onClick={closeMobileMenu}
                  className="text-lg font-medium text-white hover:text-blue-400 transition-colors"
                >
                  {tc('dashboard')}
                </Link>
                <button
                  onClick={() => {
                    handleSignOut();
                    closeMobileMenu();
                  }}
                  className="flex items-center gap-2 text-lg font-medium text-gray-400 hover:text-white transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  {tc('signOut')}
                </button>
              </div>
            ) : (
              <Link
                href="/auth"
                onClick={closeMobileMenu}
                className="block text-center px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
              >
                {tc('signIn')}
              </Link>
            )}
          </div>

          <div className="mt-auto pb-8 pt-6 border-t border-white/10">
            <LanguageSwitcher onLocaleChange={closeMobileMenu} />
          </div>
        </div>
      </div>
    </>
  );
}
