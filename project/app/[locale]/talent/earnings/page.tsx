'use client';

/*
  Talent earnings module — the talent's OWN payouts (real data from
  /api/talent/earnings, scoped to their session). Shows their share only; never
  the order's real total or internal cost.
*/

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { supabase } from '@/lib/supabase';
import { DollarSign, Loader2 } from 'lucide-react';

type Earning = { id: string; order_type: string | null; commission_amount: number | null; status: string | null; created_at: string };
type Totals = { paid: number; pending: number; total: number };

export default function TalentEarningsPage() {
  const locale = useLocale();
  const isZhCN = locale === 'zh-CN';
  const isZh = locale.startsWith('zh');
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  const [state, setState] = useState<'loading' | 'unauth' | 'ready'>('loading');
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [totals, setTotals] = useState<Totals>({ paid: 0, pending: 0, total: 0 });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { setState('unauth'); return; }
      try {
        const r = await fetch('/api/talent/earnings', { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) { setState('unauth'); return; }
        const j = await r.json();
        setEarnings(Array.isArray(j.earnings) ? j.earnings : []);
        setTotals(j.totals || { paid: 0, pending: 0, total: 0 });
        setState('ready');
      } catch { setState('unauth'); }
    })();
  }, []);

  const money = (n: number) => `US$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const fmtDate = (s: string) => { try { return new Date(s).toLocaleDateString(); } catch { return s; } };
  const statusLabel = (s: string | null) =>
    s === 'paid' ? tx('已付款', '已付款', 'Paid') : s === 'pending' ? tx('待付款', '待付款', 'Pending') : (s || tx('處理中', '处理中', 'Processing'));

  if (state === 'loading') {
    return <main className="min-h-screen bg-black text-white flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></main>;
  }
  if (state === 'unauth') {
    return (
      <main className="min-h-screen bg-black text-white px-4 py-16">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-xl font-semibold mb-2">{tx('請先登入', '请先登录', 'Please sign in')}</h1>
          <p className="text-gray-400 text-sm mb-4">{tx('登入配音員帳號後即可查看收款。', '登录配音员账号后即可查看收款。', 'Sign in to your talent account to view earnings.')}</p>
          <Link href="/auth" className="text-amber-300 text-sm hover:text-amber-200">{tx('前往登入 →', '前往登录 →', 'Sign in →')}</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white px-4 py-12 md:py-16">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-1 flex items-center gap-2"><DollarSign className="w-6 h-6 text-amber-300" /> {tx('收款', '收款', 'Earnings')}</h1>
        <p className="text-sm text-gray-400 mb-6">{tx('您透過 Onyx 接案/分潤所得,月結。', '您通过 Onyx 接案/分润所得,月结。', 'Your share from work and royalties through Onyx, settled monthly.')}</p>

        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: tx('累計', '累计', 'Total'), v: totals.total, c: 'text-white' },
            { label: tx('已付款', '已付款', 'Paid'), v: totals.paid, c: 'text-green-400' },
            { label: tx('待付款', '待付款', 'Pending'), v: totals.pending, c: 'text-amber-300' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[11px] text-gray-500 mb-1">{s.label}</p>
              <p className={`text-lg font-bold ${s.c}`}>{money(s.v)}</p>
            </div>
          ))}
        </div>

        {earnings.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
            <p className="text-gray-400 text-sm">{tx('目前還沒有收款紀錄。接到案子、或您的 AI 聲音被使用後,分潤會顯示在這裡。', '目前还没有收款记录。接到案子、或您的 AI 声音被使用后,分润会显示在这里。', 'No earnings yet. Your payouts will appear here once you take on work or your AI voice is used.')}</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.03] text-gray-500 text-xs">
                  <th className="text-left font-medium px-4 py-2.5">{tx('日期', '日期', 'Date')}</th>
                  <th className="text-left font-medium px-4 py-2.5">{tx('類型', '类型', 'Type')}</th>
                  <th className="text-right font-medium px-4 py-2.5">{tx('金額', '金额', 'Amount')}</th>
                  <th className="text-right font-medium px-4 py-2.5">{tx('狀態', '状态', 'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {earnings.map((e) => (
                  <tr key={e.id} className="border-t border-white/5">
                    <td className="px-4 py-3 text-gray-300">{fmtDate(e.created_at)}</td>
                    <td className="px-4 py-3 text-gray-400">{e.order_type || '—'}</td>
                    <td className="px-4 py-3 text-right text-white font-medium">{money(e.commission_amount || 0)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${e.status === 'paid' ? 'bg-green-500/15 text-green-300' : 'bg-amber-500/15 text-amber-300'}`}>{statusLabel(e.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
