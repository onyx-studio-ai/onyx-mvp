'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { DollarSign, ShoppingCart, Music, Mic, ArrowRight, RefreshCw } from 'lucide-react';
import { TrafficChart, VoiceBarChart, SectionHeader } from './components';
import TrafficSection from './TrafficSection';
import { getVoiceTierLabel, getMusicTierLabel } from '@/lib/config/pricing.config';

interface DashboardStats {
  totalRevenue: number;
  voiceRevenue: number;
  musicRevenue: number;
  totalOrders: number;
  paidOrders: number;
  pendingOrders: number;
  recentTransactions: RecentTx[];
  dailyData: DailyData[];
  voiceBreakdown: VoiceData[];
}

interface RecentTx {
  id: string;
  email: string;
  action: string;
  amount: number;
  created_at: string;
  type: 'voice' | 'music';
}

interface DailyData {
  day: string;
  orders: number;
  revenue: number;
}

interface VoiceData {
  voice: string;
  orders: number;
  percentage: number;
}

function formatCurrency(val: number) {
  if (val >= 1000000) return `US$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `US$${(val / 1000).toFixed(1)}K`;
  return `US$${val.toFixed(0)}`;
}

// 顯示字串走 i18n:把 t 傳進來,只換文字不動時間計算邏輯。
function timeAgo(dateStr: string, t: ReturnType<typeof useTranslations>) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('justNow');
  if (mins < 60) return t('minsAgo', { mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('hrsAgo', { hrs });
  return t('daysAgo', { days: Math.floor(hrs / 24) });
}

export default function AdminDashboardPage() {
  const t = useTranslations('admin.dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);

    try {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) { setLoading(false); return; }
      type AdminOrder = {
        id: string;
        email: string;
        price?: string | number | null;
        payment_status?: string | null;
        status?: string | null;
        paid_at?: string | null;
        created_at: string;
        voice_selection?: string | null;
        tier?: string | null;
        vibe?: string | null;
      };

      const { voiceOrders: vo_raw, musicOrders: mo_raw } = await res.json();
      const vo: AdminOrder[] = vo_raw || [];
      const mo: AdminOrder[] = mo_raw || [];

    const paidVoice = vo.filter((o) => o.payment_status === 'completed');
    const paidMusic = mo.filter((o) => o.payment_status === 'completed');

    const voiceRevenue = paidVoice.reduce((s, o) => s + parseFloat(String(o.price ?? '0')), 0);
    const musicRevenue = paidMusic.reduce((s, o) => s + parseFloat(String(o.price ?? '0')), 0);

    const pending = [...vo, ...mo].filter(
      (o) => o.payment_status === 'pending' && o.status !== 'draft'
    ).length;

    const allPaid = [
      ...paidVoice.map((o) => ({ ...o, _type: 'voice' as const })),
      ...paidMusic.map((o) => ({ ...o, _type: 'music' as const })),
    ].sort((a, b) => new Date(b.paid_at || b.created_at).getTime() - new Date(a.paid_at || a.created_at).getTime());

    const recentTransactions: RecentTx[] = allPaid.slice(0, 8).map((o) => ({
      id: o.id,
      email: o.email,
      action:
        o._type === 'voice'
          ? `Voice Order${o.voice_selection ? ` – ${o.voice_selection.split(' ')[0]}` : ''} (${getVoiceTierLabel(o.tier || 'tier-1')})`
          : `Music Order${o.vibe ? ` – ${o.vibe}` : ''} (${getMusicTierLabel(o.tier || '')})`,
      amount: parseFloat(String(o.price ?? '0')),
      created_at: o.paid_at || o.created_at,
      type: o._type,
    }));

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dailyMap: Record<string, { orders: number; revenue: number }> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dailyMap[key] = { orders: 0, revenue: 0 };
    }

    [...paidVoice.map((o) => ({ ...o, _type: 'voice' })), ...paidMusic.map((o) => ({ ...o, _type: 'music' }))].forEach((o) => {
      const key = (o.paid_at || o.created_at).split('T')[0];
      if (dailyMap[key]) {
        dailyMap[key].orders++;
        dailyMap[key].revenue += parseFloat(String(o.price ?? '0'));
      }
    });

    const dailyData: DailyData[] = Object.entries(dailyMap).map(([date, val]) => ({
      day: dayLabels[new Date(date).getDay()],
      orders: val.orders,
      revenue: val.revenue,
    }));

    const voiceCount: Record<string, number> = {};
    paidVoice.forEach((o) => {
      const name = o.voice_selection ? o.voice_selection.split(' ')[0] : 'Unknown';
      voiceCount[name] = (voiceCount[name] || 0) + 1;
    });
    const totalVoicePaid = paidVoice.length || 1;
    const voiceBreakdown: VoiceData[] = Object.entries(voiceCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([voice, orders]) => ({
        voice,
        orders,
        percentage: Math.round((orders / totalVoicePaid) * 100),
      }));

    setStats({
      totalRevenue: voiceRevenue + musicRevenue,
      voiceRevenue,
      musicRevenue,
      totalOrders: (vo as any[]).length + (mo as any[]).length,
      paidOrders: paidVoice.length + paidMusic.length,
      pendingOrders: pending,
      recentTransactions,
      dailyData,
      voiceBreakdown,
    });
    } catch {
      // Failed to fetch stats
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">{t('loading')}</div>
      </div>
    );
  }

  const s = stats!;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">{t('title')}</h1>
              <p className="text-gray-600 text-sm mt-1">{t('subtitle')}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchStats}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm transition-colors"
              >
                <RefreshCw size={14} />
                {t('refresh')}
              </button>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-50 border border-green-200">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-700 text-sm font-medium">{t('live')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <section>
          <SectionHeader title={t('revenueOverview')} />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-600 text-sm">{t('totalRevenue')}</span>
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-500" />
                </div>
              </div>
              <p className="text-2xl font-bold text-green-700">{formatCurrency(s.totalRevenue)}</p>
              <p className="text-xs text-gray-600 mt-1">{t('totalRevenueDesc')}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-600 text-sm">{t('voiceRevenue')}</span>
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Mic className="w-5 h-5 text-blue-700" />
                </div>
              </div>
              <p className="text-2xl font-bold text-blue-700">{formatCurrency(s.voiceRevenue)}</p>
              <p className="text-xs text-gray-600 mt-1">{t('percentOfTotal', { percent: s.paidOrders > 0 ? Math.round((s.voiceRevenue / s.totalRevenue) * 100) : 0 })}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-600 text-sm">{t('musicRevenue')}</span>
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Music className="w-5 h-5 text-amber-700" />
                </div>
              </div>
              <p className="text-2xl font-bold text-amber-700">{formatCurrency(s.musicRevenue)}</p>
              <p className="text-xs text-gray-600 mt-1">{t('percentOfTotal', { percent: s.totalRevenue > 0 ? Math.round((s.musicRevenue / s.totalRevenue) * 100) : 0 })}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-600 text-sm">{t('totalOrders')}</span>
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-gray-700" />
                </div>
              </div>
              <p className="text-2xl font-bold">{s.totalOrders}</p>
              <p className="text-xs text-gray-600 mt-1">{t('ordersPaidPending', { paid: s.paidOrders, pending: s.pendingOrders })}</p>
            </div>
          </div>
        </section>

        {/* 真實訪客流量(純新增,獨立取數,不影響上方訂單卡) */}
        <TrafficSection />

        <section>
          <SectionHeader title={t('last7Days')} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TrafficChart data={s.dailyData} title={t('dailyOrdersTitle')} description={t('dailyOrdersDesc')} />
            {s.voiceBreakdown.length > 0 ? (
              <VoiceBarChart data={s.voiceBreakdown} title={t('topVoicesTitle')} description={t('topVoicesDesc')} />
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl p-6 flex items-center justify-center">
                <p className="text-gray-600 text-sm">{t('noVoiceOrders')}</p>
              </div>
            )}
          </div>
        </section>

        <section>
          <SectionHeader title={t('recentPaidOrders')} />
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {s.recentTransactions.length === 0 ? (
              <div className="text-center py-12 text-gray-600 text-sm">{t('noPaidOrders')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">{t('colCustomer')}</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">{t('colOrder')}</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">{t('colType')}</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">{t('colTime')}</th>
                      <th className="text-right px-6 py-4 text-sm font-medium text-gray-600">{t('colAmount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.recentTransactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className="border-b border-gray-200/50 hover:bg-white/50 transition-colors"
                      >
                        <td className="px-6 py-4 text-sm text-gray-700">{tx.email}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{tx.action}</td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            tx.type === 'voice'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {tx.type === 'voice' ? t('typeVoice') : t('typeMusic')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{timeAgo(tx.created_at, t)}</td>
                        <td className="px-6 py-4 text-sm text-right font-semibold text-green-700">
                          +{formatCurrency(tx.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="px-6 py-4 border-t border-gray-200 bg-white/30">
              <Link
                href="/admin/orders"
                className="inline-flex items-center gap-2 text-sm text-blue-700 hover:text-blue-700 transition-colors group"
              >
                <span>{t('viewAllOrders')}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

        <section>
          <SectionHeader title={t('quickStats')} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-gray-900">{s.paidOrders}</p>
              <p className="text-gray-600 text-sm mt-1">{t('statPaidOrders')}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-amber-700">{s.pendingOrders}</p>
              <p className="text-gray-600 text-sm mt-1">{t('statAwaitingPayment')}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-blue-700">
                {s.totalOrders > 0 ? Math.round((s.paidOrders / s.totalOrders) * 100) : 0}%
              </p>
              <p className="text-gray-600 text-sm mt-1">{t('statConversionRate')}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-green-700">
                {s.paidOrders > 0 ? formatCurrency(s.totalRevenue / s.paidOrders) : 'US$0'}
              </p>
              <p className="text-gray-600 text-sm mt-1">{t('statAvgOrderValue')}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
