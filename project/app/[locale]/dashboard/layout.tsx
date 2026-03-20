'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { FileAudio, Settings, LogOut, Receipt } from 'lucide-react';
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

  const mainLinks = [
    { href: '/voice', label: tr('navVoiceStudio', '配音工作室') },
    { href: '/music', label: tr('navMusicStudio', '音樂工作室') },
    { href: '/contact', label: tr('navContact', '聯絡我們') },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-[#050505] border-b border-white/[0.06] z-40 flex items-center px-6">
      <Link href="/" className="flex items-center flex-shrink-0">
        <img
          src="/logo-onyx.png"
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

function Sidebar() {
  const pathname = usePathname();
  const safePathname = pathname || '';
  const user = useDashboardUser();
  const t = useTranslations('dashboard');
  const tr = (key: string, fallback: string) => {
    const value = t(key as any);
    return value === `dashboard.${key}` ? fallback : value;
  };

  const nav = [
    { href: '/dashboard', label: tr('navProjects', '專案') , icon: FileAudio },
    { href: '/dashboard/invoices', label: tr('navInvoices', '發票'), icon: Receipt },
    { href: '/dashboard/settings', label: tr('navSettings', '設定'), icon: Settings },
  ];

  const displayName = user.user_metadata?.full_name || user.email;

  return (
    <aside className="hidden md:flex w-56 flex-col fixed top-16 bottom-0 border-r border-white/[0.06] bg-[#050505] z-30">
      <nav className="flex-1 p-4 space-y-1 pt-6">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            href === '/dashboard'
              ? safePathname === '/dashboard' || safePathname.startsWith('/dashboard/orders')
              : safePathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-white/[0.08] text-white'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/[0.06]">
        <div className="px-1">
          <p className="text-xs text-gray-300 font-medium truncate">{displayName}</p>
          <p className="text-[11px] text-gray-500 truncate mt-0.5">{user.email}</p>
        </div>
      </div>
    </aside>
  );
}

function MobileNav() {
  const pathname = usePathname();
  const safePathname = pathname || '';
  const t = useTranslations('dashboard');
  const tr = (key: string, fallback: string) => {
    const value = t(key as any);
    return value === `dashboard.${key}` ? fallback : value;
  };
  const nav = [
    { href: '/dashboard', label: tr('navProjects', '專案') },
    { href: '/dashboard/invoices', label: tr('navInvoices', '發票') },
    { href: '/dashboard/settings', label: tr('navSettings', '設定') },
  ];

  return (
    <div className="md:hidden flex items-center gap-1 px-4 py-2.5 border-b border-white/[0.06] bg-[#080808]">
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
              active
                ? 'bg-white/[0.08] text-white'
                : 'text-gray-500 hover:text-gray-300'
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
  return (
    <DashboardProvider>
      <div className="min-h-screen bg-[#050505]">
        <DashboardHeader />
        <Sidebar />
        <div className="md:ml-56 pt-16 min-h-screen">
          <MobileNav />
          {children}
        </div>
      </div>
    </DashboardProvider>
  );
}
