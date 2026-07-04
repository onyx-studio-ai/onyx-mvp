'use client';

/*
  後台「流量」儀表板 —— 自建輕量 analytics 的檢視端。
  資料來自 /api/admin/analytics(requireAdminOnly,聚合查詢,只近 30 天)。

  版面依 light-admin 標準:靠左 p-6 lg:p-10 max-w-5xl + AdminHeader + AdminStats(頂部統計卡)
  + 下方數個「長條列」表格(熱門頁 / 語系 / 國家 / 轉換事件)。
  註:memory 的「後台版面標準」提到 StatModule,但那個元件是深色儀表板用(text-white),
  在 light-admin 會白字白底看不見;light-admin 的實際標準卡是 AdminStats(costs/finance 皆用),故沿用。
  全 lucide 線條 icon、無 emoji。
*/

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { RefreshCw, FileText, Globe, Languages, Target } from 'lucide-react';
import { AdminHeader, AdminStats } from '@/components/admin/list-ui';

type CountRow = { key: string; count: number };
type Conversions = { hire_submit: number; quote_submit: number; apply_submit: number };
type Analytics = {
  today: { visitors: number; pageviews: number; conversions: Conversions };
  week: { visitors: number; pageviews: number; conversions: Conversions };
  topPages: CountRow[];
  locales: CountRow[];
  countries: CountRow[];
  totalConversionsToday: number;
};

const EVENT_LABEL: Record<keyof Conversions, string> = {
  hire_submit: '詢價送出',
  quote_submit: '配音員報價',
  apply_submit: '配音員申請',
};

// 一個「長條列」區塊:標題 + icon + 每列(名稱 + 數量 + 依比例的底色長條)。
function BarList({
  title, icon: Icon, rows, emptyHint,
}: {
  title: string; icon: typeof FileText; rows: CountRow[]; emptyHint: string;
}) {
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Icon className="w-4 h-4 text-gray-500" /> {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyHint}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.key} className="relative flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-blue-50 rounded-lg" style={{ width: `${(r.count / max) * 100}%` }} />
              <span className="relative text-sm text-gray-800 truncate">{r.key}</span>
              <span className="relative text-sm font-medium text-gray-900 tabular-nums shrink-0">{r.count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminAnalytics() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/analytics', { credentials: 'include' });
      if (!res.ok) { toast.error('載入流量資料失敗'); return; }
      setData(await res.json());
    } catch {
      toast.error('連線失敗,請稍後再試');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const eventRows = (c: Conversions): CountRow[] =>
    (Object.keys(EVENT_LABEL) as (keyof Conversions)[]).map((k) => ({ key: EVENT_LABEL[k], count: c[k] }));

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <AdminHeader
        title="流量"
        subtitle="自建輕量分析 · 只存國家碼與匿名訪客 id,不存完整 IP · 統計近 30 天"
        action={(
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> 重新整理
          </button>
        )}
      />

      <AdminStats items={[
        { label: '今日訪客', value: data?.today.visitors ?? '—' },
        { label: '今日瀏覽', value: data?.today.pageviews ?? '—' },
        { label: '近 7 天訪客', value: data?.week.visitors ?? '—', color: 'text-blue-700' },
        { label: '今日轉換數', value: data?.totalConversionsToday ?? '—', color: 'text-green-700' },
      ]} />

      {loading && !data ? (
        <div className="text-center py-16">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3" />
          <p className="text-gray-500">載入中...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <BarList title="熱門頁 Top 10（近 7 天瀏覽）" icon={FileText} rows={data?.topPages ?? []} emptyHint="尚無資料" />
          </div>
          <BarList title="語系分布（近 7 天）" icon={Languages} rows={data?.locales ?? []} emptyHint="尚無資料" />
          <BarList title="國家 Top 10（近 7 天）" icon={Globe} rows={data?.countries ?? []} emptyHint="尚無資料（本地環境無國家碼)" />
          <BarList title="轉換事件（今日)" icon={Target} rows={data ? eventRows(data.today.conversions) : []} emptyHint="尚無資料" />
          <BarList title="轉換事件（近 7 天)" icon={Target} rows={data ? eventRows(data.week.conversions) : []} emptyHint="尚無資料" />
        </div>
      )}
    </div>
  );
}
