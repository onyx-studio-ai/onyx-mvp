'use client';

import { useState, useEffect, useCallback } from 'react';
import { Link } from '@/i18n/navigation';
import { DollarSign, ShoppingCart, Music, Mic, ArrowRight, RefreshCw } from 'lucide-react';
import { TrafficChart, VoiceBarChart, SectionHeader } from './components';
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

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);

    try {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) { setLoading(false); return; }
      const { voiceOrders: vo_raw, musicOrders: mo_raw } = await res.json();
      const vo = vo_raw || [];
      const mo = mo_raw || [];

    const paidVoice = vo.filter((o) => o.payment_status === 'completed');
    const paidMusic = mo.filter((o) => o.payment_status === 'completed');

    const voiceRevenue = paidVoice.reduce((s, o) => s + parseFloat(o.price || '0'), 0);
    const musicRevenue = paidMusic.reduce((s, o) => s + parseFloat(o.price || '0'), 0);

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
      amount: parseFloat(o.price || '0'),
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
        dailyMap[key].revenue += parseFloat(o.price || '0');
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  const s = stats!;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-white/10 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Admin Dashboard</h1>
              <p className="text-gray-400 text-sm mt-1">Live business data</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchStats}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-gray-300 text-sm transition-colors"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-400 text-sm font-medium">Live</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <section>
          <SectionHeader title="Revenue Overview" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-sm">Total Revenue</span>
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-500" />
                </div>
              </div>
              <p className="text-2xl font-bold text-green-400">{formatCurrency(s.totalRevenue)}</p>
              <p className="text-xs text-gray-400 mt-1">All time paid orders</p>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-sm">Voice Revenue</span>
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Mic className="w-5 h-5 text-blue-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-blue-400">{formatCurrency(s.voiceRevenue)}</p>
              <p className="text-xs text-gray-400 mt-1">{s.paidOrders > 0 ? Math.round((s.voiceRevenue / s.totalRevenue) * 100) : 0}% of total</p>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-sm">Music Revenue</span>
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Music className="w-5 h-5 text-amber-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-amber-400">{formatCurrency(s.musicRevenue)}</p>
              <p className="text-xs text-gray-400 mt-1">{s.totalRevenue > 0 ? Math.round((s.musicRevenue / s.totalRevenue) * 100) : 0}% of total</p>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-sm">Total Orders</span>
                <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-gray-300" />
                </div>
              </div>
              <p className="text-2xl font-bold">{s.totalOrders}</p>
              <p className="text-xs text-gray-400 mt-1">{s.paidOrders} paid · {s.pendingOrders} pending</p>
            </div>
          </div>
        </section>

        <section>
          <SectionHeader title="Last 7 Days" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TrafficChart data={s.dailyData} />
            {s.voiceBreakdown.length > 0 ? (
              <VoiceBarChart data={s.voiceBreakdown} />
            ) : (
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 flex items-center justify-center">
                <p className="text-gray-400 text-sm">No voice orders yet</p>
              </div>
            )}
          </div>
        </section>

        <section>
          <SectionHeader title="Recent Paid Orders" />
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
            {s.recentTransactions.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">No paid orders yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Customer</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Order</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Type</th>
                      <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Time</th>
                      <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.recentTransactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className="border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors"
                      >
                        <td className="px-6 py-4 text-sm text-gray-300">{tx.email}</td>
                        <td className="px-6 py-4 text-sm text-white">{tx.action}</td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            tx.type === 'voice'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {tx.type === 'voice' ? 'Voice' : 'Music'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-400">{timeAgo(tx.created_at)}</td>
                        <td className="px-6 py-4 text-sm text-right font-semibold text-green-400">
                          +{formatCurrency(tx.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/30">
              <Link
                href="/admin/orders"
                className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors group"
              >
                <span>View All Orders</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

        <section>
          <SectionHeader title="Quick Stats" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-white">{s.paidOrders}</p>
              <p className="text-gray-400 text-sm mt-1">Paid Orders</p>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-amber-400">{s.pendingOrders}</p>
              <p className="text-gray-400 text-sm mt-1">Awaiting Payment</p>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-blue-400">
                {s.totalOrders > 0 ? Math.round((s.paidOrders / s.totalOrders) * 100) : 0}%
              </p>
              <p className="text-gray-400 text-sm mt-1">Conversion Rate</p>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-green-400">
                {s.paidOrders > 0 ? formatCurrency(s.totalRevenue / s.paidOrders) : 'US$0'}
              </p>
              <p className="text-gray-400 text-sm mt-1">Avg. Order Value</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
