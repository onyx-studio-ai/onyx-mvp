'use client';

import { useState, useEffect } from 'react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { Menu, X, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';

interface NavigationLink {
  href: string;
  label: string;
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const t = useTranslations('navbar');
  const tc = useTranslations('common');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push('/');
  };

  const isDashboard = pathname?.startsWith('/dashboard') || pathname?.startsWith('/admin');

  const isVoiceContext = pathname?.startsWith('/voice') || pathname === '/voices' || pathname === '/pricing';
  const isMusicContext = pathname?.startsWith('/music');
  const isLobby = pathname === '/';

  if (isDashboard) return null;

  const mainModules = [
    { href: '/voice' as const, label: t('voiceStudio') },
    { href: '/music' as const, label: t('musicStudio') },
  ];

  const getContextTools = (): NavigationLink[] => {
    if (isVoiceContext) {
      return [
        { href: '/voices', label: t('browseVoices') },
        { href: '/pricing', label: t('pricing') },
      ];
    }

    if (isMusicContext) {
      return [
        { href: '/music/catalog', label: t('catalog') },
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

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-24">
            <Link href="/" className="flex items-center">
              <img
                src="/logo-onyx.png"
                alt="Onyx Studios"
                className="h-[80px] w-auto"
              />
            </Link>

            <div className="hidden md:flex items-center gap-8">
              {mainModules.map((module) => {
                let isActive = false;

                if (module.href === '/voice' && isVoiceContext) {
                  isActive = true;
                }

                if (module.href === '/music' && isMusicContext) {
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
                    const isActive = pathname === tool.href;

                    return (
                      <Link
                        key={tool.href}
                        href={tool.href}
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
                    href="/dashboard"
                    className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                      pathname === '/dashboard'
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
              aria-label="Toggle mobile menu"
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
            {mainModules.map((module) => {
              let isActive = false;

              if (module.href === '/voice' && isVoiceContext) {
                isActive = true;
              }

              if (module.href === '/music' && isMusicContext) {
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
                  const isActive = pathname === tool.href;

                  return (
                    <Link
                      key={tool.href}
                      href={tool.href}
                      onClick={() => closeMobileMenu()}
                      className={`text-lg font-medium transition-colors ${
                        isActive
                          ? 'text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {tool.label}
                      {isActive && (
                        <div className="mt-2 h-[2px] w-12 bg-blue-500" />
                      )}
                    </Link>
                  );
                })}
              </>
            )}

            <div className="h-[1px] w-full bg-white/10 my-2" />

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
                  href="/dashboard"
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
