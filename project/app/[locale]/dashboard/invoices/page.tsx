'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { supabase, Order } from '@/lib/supabase';
import { useDashboardUser } from '@/contexts/DashboardContext';
import { getMusicTierLabel } from '@/lib/config/pricing.config';
import { Receipt, Download, Loader2, Music, Music2, Mic2, ExternalLink } from 'lucide-react';
import StatusBadge from '@/components/dashboard/StatusBadge';

type InvoiceItem = {
  id: string;
  type: 'voice' | 'music' | 'orchestra';
  order_number: string;
  display_name: string;
  paid_at: string | null;
  price: number;
  status: string;
  subtitle?: string;
};

export default function InvoicesPage() {
  const t = useTranslations('dashboard.invoices');
  const user = useDashboardUser();
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!user.email) return;
    setLoading(true);
    try {
      const [voiceRes, musicRes, orchRes] = await Promise.all([
        supabase
          .from('voice_orders')
          .select('id, order_number, project_name, tone_style, voice_selection, language, price, status, paid_at')
          .eq('email', user.email)
          .not('paid_at', 'is', null)
          .order('paid_at', { ascending: false }),
        supabase
          .from('music_orders')
          .select('id, order_number, vibe, usage_type, tier, price, status, paid_at, created_at')
          .eq('email', user.email)
          .not('paid_at', 'is', null)
          .order('paid_at', { ascending: false }),
        fetch(`/api/orders/orchestra?email=${encodeURIComponent(user.email)}`)
          .then(r => r.json())
          .catch(() => []),
      ]);

      const voiceItems: InvoiceItem[] = (voiceRes.data || []).map((o: Order) => ({
        id: o.id,
        type: 'voice',
        order_number: String(o.order_number),
        display_name: o.project_name || `AI Voiceover - ${new Date(o.paid_at || '').toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' })}`,
        paid_at: o.paid_at,
        price: Number(o.price),
        status: o.status,
        subtitle: o.language,
      }));

      const musicItems: InvoiceItem[] = (musicRes.data || []).map((o: Record<string, unknown>) => ({
        id: String(o.id),
        type: 'music',
        order_number: String(o.order_number || o.id),
        display_name: o.vibe ? `${String(o.vibe)} Music` : 'Custom Music',
        paid_at: String(o.paid_at || o.created_at || ''),
        price: Number(o.price),
        status: String(o.status || 'paid'),
        subtitle: String(o.usage_type || (o.tier ? getMusicTierLabel(String(o.tier)) : '')),
      }));

      const orchData = Array.isArray(orchRes) ? orchRes : [];
      const orchItems: InvoiceItem[] = orchData
        .filter((o: Record<string, unknown>) => o.payment_status === 'paid')
        .map((o: Record<string, unknown>) => ({
          id: String(o.id),
          type: 'orchestra' as const,
          order_number: String(o.order_number || o.id),
          display_name: o.project_name ? String(o.project_name) : 'Live Strings Session',
          paid_at: String(o.created_at || ''),
          price: Number(o.price),
          status: String(o.status || 'paid'),
          subtitle: o.tier_name ? String(o.tier_name) : '',
        }));

      const all = [...voiceItems, ...musicItems, ...orchItems].sort((a, b) => {
        if (!a.paid_at) return 1;
        if (!b.paid_at) return -1;
        return new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime();
      });

      setItems(all);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user.email]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleDownload = async (item: InvoiceItem) => {
    setDownloading(item.id);
    try {
      const res = await fetch(`/api/invoices/${item.id}?type=${item.type}`);
      if (!res.ok) throw new Error('Failed to generate invoice');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${item.order_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent
    } finally {
      setDownloading(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) =>
    `US$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="text-white p-6 lg:p-10">
      <div className="max-w-4xl">
        <div className="mb-8">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2 font-medium">
            Billing
          </p>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('subtitle')}</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] py-20 text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-white/[0.05] flex items-center justify-center mb-5">
              <Receipt className="w-6 h-6 text-gray-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-400 mb-1">{t('noInvoicesTitle')}</h3>
            <p className="text-gray-600 text-sm">{t('noInvoicesDesc')}</p>
          </div>
        ) : (
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 px-5 py-3 border-b border-white/[0.06] text-[10px] text-gray-500 uppercase tracking-wider font-medium">
              <span>{t('columnOrder')}</span>
              <span className="text-right w-28">{t('columnDate')}</span>
              <span className="text-right w-20">{t('columnAmount')}</span>
              <span className="text-right w-24">{t('columnStatus')}</span>
              <span className="text-right w-24">{t('columnInvoice')}</span>
            </div>

            <div className="divide-y divide-white/[0.04]">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      item.type === 'music' ? 'bg-emerald-500/10' :
                      item.type === 'orchestra' ? 'bg-amber-500/10' :
                      'bg-blue-500/10'
                    }`}>
                      {item.type === 'music' ? (
                        <Music className="w-3.5 h-3.5 text-emerald-400" />
                      ) : item.type === 'orchestra' ? (
                        <Music2 className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <Mic2 className="w-3.5 h-3.5 text-blue-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{item.display_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          item.type === 'music' ? 'text-emerald-400 bg-emerald-500/10' :
                          item.type === 'orchestra' ? 'text-amber-400 bg-amber-500/10' :
                          'text-blue-400 bg-blue-500/10'
                        }`}>
                          #{String(item.order_number).padStart(4, '0')}
                        </span>
                        {item.subtitle && (
                          <span className="text-[10px] text-gray-600">{item.subtitle}</span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          item.type === 'music' ? 'text-emerald-400 bg-emerald-500/10' :
                          item.type === 'orchestra' ? 'text-amber-400 bg-amber-500/10' :
                          'text-blue-400 bg-blue-500/10'
                        }`}>
                          {item.type === 'music' ? 'Music' : item.type === 'orchestra' ? 'Strings' : 'Voice'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="text-gray-400 text-xs text-right w-28 whitespace-nowrap">
                    {formatDate(item.paid_at)}
                  </span>

                  <span className="text-white text-sm font-semibold text-right w-20 tabular-nums">
                    {formatCurrency(item.price)}
                  </span>

                  <div className="text-right w-24 flex justify-end">
                    <StatusBadge status={item.status} />
                  </div>

                  <div className="text-right w-24 flex justify-end">
                    <button
                      onClick={() => handleDownload(item)}
                      disabled={downloading === item.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.10] border border-white/10 text-xs text-gray-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {downloading === item.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      {t('buttonDownload')}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-white/[0.06] flex items-center justify-between">
              <span className="text-xs text-gray-600">{items.length} invoice{items.length !== 1 ? 's' : ''} total</span>
              <span className="text-sm font-semibold text-white">
                Total paid: {formatCurrency(items.reduce((sum, o) => sum + o.price, 0))}
              </span>
            </div>
          </div>
        )}

        <div className="mt-6 rounded-xl bg-white/[0.02] border border-white/[0.05] px-5 py-4 flex items-start gap-3">
          <ExternalLink className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
          <p className="text-xs text-gray-500 leading-relaxed">
            Invoices are generated automatically for all paid orders. Each invoice includes your order number, billing details, line items, and payment confirmation. Contact support if you need a formal tax invoice.
          </p>
        </div>
      </div>
    </div>
  );
}
