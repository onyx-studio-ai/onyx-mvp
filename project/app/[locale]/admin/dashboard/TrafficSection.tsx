'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Eye, Users, Globe, FileText, TrendingUp } from 'lucide-react';
import { SectionHeader } from './components';

/**
 * 真實訪客流量區塊(純新增) — 獨立向 /api/admin/traffic 取數,
 * 完全不動既有訂單卡邏輯。任何錯誤只在本區塊顯示,不影響 dashboard 其他部分。
 */

interface TrafficData {
  windowDays: number;
  totalViews: number;
  approxVisitors: number;
  topPages: Array<{ path: string; views: number }>;
  countries: Array<{ country: string; views: number; percentage: number }>;
  dailyViews: Array<{ day: string; views: number }>;
  funnel: { views: number; inquiries: number; orders: number };
}

// 常見國家碼 → 顯示名(其餘直接顯示國碼)。老闆最關心美歐,所以先列這些。
const COUNTRY_NAMES: Record<string, string> = {
  US: '美國', TW: '台灣', GB: '英國', CN: '中國', HK: '香港',
  DE: '德國', FR: '法國', CA: '加拿大', AU: '澳洲', JP: '日本',
  SG: '新加坡', KR: '南韓', NL: '荷蘭', ES: '西班牙', IT: '義大利',
  IN: '印度', MY: '馬來西亞', TH: '泰國', ID: '印尼', VN: '越南',
  Unknown: '未知',
};

function countryLabel(code: string) {
  return COUNTRY_NAMES[code] || code;
}

export default function TrafficSection() {
  const t = useTranslations('admin.traffic');
  const [data, setData] = useState<TrafficData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchTraffic = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/admin/traffic');
      if (!res.ok) {
        setError(true);
        setLoading(false);
        return;
      }
      setData(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTraffic();
  }, [fetchTraffic]);

  if (loading) {
    return (
      <section>
        <SectionHeader title={t('websiteTraffic')} />
        <div className="bg-white border border-gray-200 rounded-2xl p-6 text-gray-600 text-sm">
          {t('loading')}
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section>
        <SectionHeader title={t('websiteTraffic')} />
        <div className="bg-white border border-gray-200 rounded-2xl p-6 text-gray-600 text-sm">
          {t('empty')}
        </div>
      </section>
    );
  }

  const d = data;
  const funnelInquiryRate = d.funnel.views > 0 ? ((d.funnel.inquiries / d.funnel.views) * 100).toFixed(1) : '0';
  const funnelOrderRate = d.funnel.inquiries > 0 ? ((d.funnel.orders / d.funnel.inquiries) * 100).toFixed(1) : '0';

  // 趨勢圖標籤:MM/DD
  const trend = d.dailyViews.map((v) => ({
    day: v.day.slice(5).replace('-', '/'),
    views: v.views,
  }));

  return (
    <>
      <section>
        <SectionHeader title={t('websiteTrafficWindow', { days: d.windowDays })} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-600 text-sm">{t('totalPageViews')}</span>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Eye className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-indigo-700">{d.totalViews.toLocaleString()}</p>
            <p className="text-xs text-gray-600 mt-1">{t('totalPageViewsDesc')}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-600 text-sm">{t('approxVisitors')}</span>
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                <Users className="w-5 h-5 text-teal-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-teal-700">{d.approxVisitors.toLocaleString()}</p>
            <p className="text-xs text-gray-600 mt-1">{t('approxVisitorsDesc')}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-600 text-sm">{t('countries')}</span>
              <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center">
                <Globe className="w-5 h-5 text-sky-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-sky-700">{d.countries.filter((c) => c.country !== 'Unknown').length}</p>
            <p className="text-xs text-gray-600 mt-1">{t('countriesDesc')}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-600 text-sm">{t('viewsToInquiry')}</span>
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-violet-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-violet-700">{funnelInquiryRate}%</p>
            <p className="text-xs text-gray-600 mt-1">{t('inquiriesFromViews', { inquiries: d.funnel.inquiries, views: d.funnel.views })}</p>
          </div>
        </div>
      </section>

      <section>
        <SectionHeader title={t('trafficTrendFunnel')} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h3 className="text-gray-900 text-lg font-semibold">{t('dailyPageViews')}</h3>
            <p className="text-gray-600 text-xs mb-4">{t('dailyPageViewsDesc', { days: d.windowDays })}</p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" stroke="#888" tick={{ fill: '#888', fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} />
                <YAxis stroke="#888" tick={{ fill: '#888' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#111' }}
                />
                <Line type="monotone" dataKey="views" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 漏斗:頁面瀏覽 → 詢價 → 訂單 */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h3 className="text-gray-900 text-lg font-semibold">{t('conversionFunnel')}</h3>
            <p className="text-gray-600 text-xs mb-4">{t('conversionFunnelDesc', { days: d.windowDays })}</p>
            <div className="space-y-3">
              <FunnelBar label={t('funnelPageViews')} value={d.funnel.views} max={d.funnel.views} color="bg-indigo-500" />
              <div className="text-center text-xs text-gray-500">{t('funnelReachInquiry', { rate: funnelInquiryRate })}</div>
              <FunnelBar label={t('funnelInquiries')} value={d.funnel.inquiries} max={d.funnel.views} color="bg-violet-500" />
              <div className="text-center text-xs text-gray-500">{t('funnelInquiriesConvert', { rate: funnelOrderRate })}</div>
              <FunnelBar label={t('funnelPaidOrders')} value={d.funnel.orders} max={d.funnel.views} color="bg-green-500" />
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionHeader title={t('topPagesCountries')} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 熱門頁 */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-500" />
              <span className="text-gray-900 font-semibold">{t('topPages')}</span>
            </div>
            {d.topPages.length === 0 ? (
              <div className="px-6 py-8 text-gray-600 text-sm text-center">{t('noPageViews')}</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {d.topPages.map((p) => (
                  <div key={p.path} className="px-6 py-3 flex items-center justify-between">
                    <span className="text-sm text-gray-700 truncate max-w-[70%]" title={p.path}>{p.path}</span>
                    <span className="text-sm font-semibold text-gray-900">{p.views.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 國家分布 */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
              <Globe className="w-4 h-4 text-gray-500" />
              <span className="text-gray-900 font-semibold">{t('countriesListTitle')}</span>
            </div>
            {d.countries.length === 0 ? (
              <div className="px-6 py-8 text-gray-600 text-sm text-center">{t('noCountryData')}</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {d.countries.slice(0, 10).map((c) => (
                  <div key={c.country} className="px-6 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700">{countryLabel(c.country)}</span>
                      <span className="text-sm text-gray-600">{c.views.toLocaleString()} · {c.percentage}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full bg-sky-500 rounded-full" style={{ width: `${c.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 4 : 0) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-700">{label}</span>
        <span className="text-sm font-semibold text-gray-900">{value.toLocaleString()}</span>
      </div>
      <div className="h-6 rounded-lg bg-gray-100 overflow-hidden">
        <div className={`h-full ${color} rounded-lg transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
