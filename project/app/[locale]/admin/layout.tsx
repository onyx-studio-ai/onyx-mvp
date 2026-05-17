'use client';

import React, { useState, useEffect } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { useLocale } from 'next-intl';
import { LayoutDashboard, ShoppingCart, Users, Tag, Menu, X, LogOut, Lock, Shield, Mic, FileText, MessageSquare, Award, DollarSign, PlusCircle, Volume2, Music } from 'lucide-react';
import { cn } from '@/lib/utils';

type BadgeKey = 'orders' | 'inquiries' | 'applications';

type NavItem = { href: string; labelKey: string; icon: typeof LayoutDashboard; badgeKey?: BadgeKey };
type NavGroup = { titleKey: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    titleKey: 'orders',
    items: [
      { href: '/admin/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
      { href: '/admin/orders', labelKey: 'orders', icon: ShoppingCart, badgeKey: 'orders' },
      { href: '/admin/inquiries', labelKey: 'inquiries', icon: MessageSquare, badgeKey: 'inquiries' },
    ],
  },
  {
    titleKey: 'people',
    items: [
      { href: '/admin/applications', labelKey: 'applications', icon: FileText, badgeKey: 'applications' },
      { href: '/admin/users', labelKey: 'users', icon: Users },
      { href: '/admin/talents', labelKey: 'talentManagement', icon: Mic },
      { href: '/admin/payouts', labelKey: 'talentPayouts', icon: DollarSign },
    ],
  },
  {
    titleKey: 'content',
    items: [
      { href: '/admin/certificates', labelKey: 'certificates', icon: Award },
      { href: '/admin/promos', labelKey: 'promos', icon: Tag },
      { href: '/admin/showcases', labelKey: 'audioShowcases', icon: Volume2 },
      { href: '/admin/vibes', labelKey: 'vibes', icon: Music },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const locale = useLocale();
  const isZhTW = locale === 'zh-TW';
  const dict = isZhTW ? {
    orders: '訂單',
    dashboard: '總覽',
    inquiries: '詢問單',
    people: '人員',
    applications: '申請資料',
    users: '使用者',
    talentManagement: '人才管理',
    talentPayouts: '人才分潤',
    content: '內容',
    certificates: '授權證書',
    promos: '優惠碼',
    audioShowcases: '音訊作品',
    vibes: '音樂風格',
    invalidAdminCode: '管理員代碼無效',
    authFailed: '驗證失敗，請再試一次。',
    loading: '載入中...',
    authRequired: '需要管理員權限',
    authHint: '請輸入管理員代碼以進入後台',
    adminCode: '管理員代碼',
    adminCodePlaceholder: '請輸入管理員代碼',
    unlockPanel: '解鎖後台',
    backHome: '← 返回首頁',
    adminPanel: '管理後台',
    commandCenter: '控制中心',
    newLiveOrder: '新增即時訂單',
    exitAdmin: '離開後台',
  } : {
    orders: 'Orders',
    dashboard: 'Dashboard',
    inquiries: 'Inquiries',
    people: 'People',
    applications: 'Applications',
    users: 'Users',
    talentManagement: 'Talent Management',
    talentPayouts: 'Talent Payouts',
    content: 'Content',
    certificates: 'Certificates',
    promos: 'Promos',
    audioShowcases: 'Audio Showcases',
    vibes: 'Vibes',
    invalidAdminCode: 'Invalid admin code',
    authFailed: 'Authentication failed. Please try again.',
    loading: 'Loading...',
    authRequired: 'Admin Access Required',
    authHint: 'Enter the admin code to access the control panel',
    adminCode: 'Admin Code',
    adminCodePlaceholder: 'Enter admin code',
    unlockPanel: 'Unlock Admin Panel',
    backHome: '← Back to Home',
    adminPanel: 'Admin Panel',
    commandCenter: 'Command Center',
    newLiveOrder: 'New Live Order',
    exitAdmin: 'Exit Admin',
  };
  const tr = (key: keyof typeof dict) => dict[key];
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(true);
  const [badges, setBadges] = useState<Record<BadgeKey, number>>({ orders: 0, inquiries: 0, applications: 0 });

  useEffect(() => {
    document.documentElement.classList.add('dark');
    return () => {
      document.documentElement.classList.remove('dark');
    };
  }, []);

  useEffect(() => {
    const verifySession = async () => {
      try {
        const res = await fetch('/api/admin/auth');
        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('onyx_admin_auth');
        }
      } catch {
        localStorage.removeItem('onyx_admin_auth');
      } finally {
        setIsChecking(false);
      }
    };
    verifySession();
  }, []);

  const markSeen = (key: BadgeKey) => {
    localStorage.setItem(`admin_badge_seen_${key}`, new Date().toISOString());
    setBadges((prev) => ({ ...prev, [key]: 0 }));
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchBadges = async () => {
      try {
        const params = new URLSearchParams();
        (['orders', 'inquiries', 'applications'] as BadgeKey[]).forEach((key) => {
          const seen = localStorage.getItem(`admin_badge_seen_${key}`);
          if (seen) params.set(`${key}_since`, seen);
        });
        const res = await fetch(`/api/admin/badges?${params}`);
        const data = await res.json();
        setBadges({
          orders: data.orders || 0,
          inquiries: data.inquiries || 0,
          applications: data.applications || 0,
        });
      } catch { /* ignore */ }
    };
    fetchBadges();
    const interval = setInterval(fetchBadges, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inputCode }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('onyx_admin_auth', 'true');
        setIsAuthenticated(true);
      } else {
        setError(data.error || tr('invalidAdminCode'));
        setInputCode('');
      }
    } catch {
      setError(tr('authFailed'));
      setInputCode('');
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-400">{tr('loading')}</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 flex items-center justify-center">
                <Shield className="w-8 h-8 text-red-400" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-center text-white mb-2">
              {tr('authRequired')}
            </h1>
            <p className="text-gray-400 text-center text-sm mb-6">
              {tr('authHint')}
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="admin-code" className="block text-sm font-medium text-gray-400 mb-2">
                  {tr('adminCode')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    id="admin-code"
                    type="password"
                    value={inputCode}
                    onChange={(e) => {
                      setInputCode(e.target.value);
                      setError('');
                    }}
                    className="w-full bg-black border border-zinc-700 rounded-lg pl-11 pr-4 py-3 text-white placeholder:text-gray-600 focus:border-blue-500 focus:outline-none"
                    placeholder={tr('adminCodePlaceholder')}
                    autoFocus
                  />
                </div>
                {error && (
                  <p className="mt-2 text-sm text-red-400">{error}</p>
                )}
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors"
              >
                {tr('unlockPanel')}
              </button>
            </form>
            <div className="mt-6 pt-6 border-t border-zinc-800">
              <button
                onClick={() => window.location.href = '/'}
                className="w-full text-sm text-gray-400 hover:text-white transition-colors"
              >
                {tr('backHome')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen bg-black text-white">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-zinc-950 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">{tr('adminPanel')}</h1>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full bg-zinc-950 border-r border-zinc-800 z-40 transition-transform duration-300 flex flex-col",
          "lg:translate-x-0 w-64",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo/Brand */}
        <div className="p-6 border-b border-zinc-800">
          <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Onyx Admin
          </h1>
          <p className="text-xs text-gray-500 mt-1">{tr('commandCenter')}</p>
        </div>

        {/* Quick Action */}
        <div className="px-4 pt-4 pb-2">
          <Link
            href="/admin/orders/create"
            onClick={() => setSidebarOpen(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
              pathname === '/admin/orders/create'
                ? "bg-amber-600/20 text-amber-400 border border-amber-500/30"
                : "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/20"
            )}
          >
            <PlusCircle size={20} />
            <span className="font-medium">{tr('newLiveOrder')}</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
          {navGroups.map((group) => (
            <div key={group.titleKey}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 px-4 mb-1">{tr(group.titleKey as keyof typeof dict)}</p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                  const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => {
                        setSidebarOpen(false);
                        if (item.badgeKey) markSeen(item.badgeKey);
                      }}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200",
                        isActive
                          ? "bg-zinc-800 text-white shadow-lg"
                          : "text-gray-400 hover:bg-zinc-900 hover:text-white"
                      )}
                    >
                      <Icon size={18} />
                      <span className="text-sm font-medium flex-1">{tr(item.labelKey as keyof typeof dict)}</span>
                      {badgeCount > 0 && (
                        <span className={cn(
                          "min-w-[20px] h-5 flex items-center justify-center px-1.5 rounded-full text-white text-xs font-bold",
                          item.badgeKey === 'orders' ? 'bg-amber-600' :
                          item.badgeKey === 'applications' ? 'bg-yellow-600' :
                          'bg-blue-600'
                        )}>
                          {badgeCount > 99 ? '99+' : badgeCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-zinc-800">
          <button
            onClick={async () => {
              await fetch('/api/admin/auth', { method: 'DELETE' }).catch(() => {});
              localStorage.removeItem('onyx_admin_auth');
              window.location.href = '/';
            }}
            className="flex items-center gap-3 px-4 py-3 w-full text-gray-400 hover:bg-zinc-900 hover:text-white rounded-lg transition-all duration-200"
          >
            <LogOut size={20} />
            <span className="font-medium">{tr('exitAdmin')}</span>
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-64 pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
