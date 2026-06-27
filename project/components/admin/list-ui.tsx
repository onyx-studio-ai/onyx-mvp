'use client';

/*
  Shared admin list-page chrome — the "Order Management" look Wing standardised on:
  a big title + subtitle + right-aligned action, and a row of white stat cards
  (label on top, big number). Use on every admin list page so 客戶請求 / 詢問單 /
  案件·發案 / 申請資料 / 人才管理 / 訂單 all read the same. Light theme (admin).
*/

import type { ReactNode } from 'react';

export function AdminHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-8">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">{title}</h1>
        {subtitle && <p className="text-gray-600 text-sm">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function AdminStats({ items }: { items: { label: ReactNode; value: ReactNode; color?: string }[] }) {
  if (!items.length) return null;
  const cols = items.length <= 4 ? 'md:grid-cols-4' : items.length === 5 ? 'md:grid-cols-5' : items.length === 6 ? 'md:grid-cols-6' : 'md:grid-cols-7';
  return (
    <div className={`grid grid-cols-2 ${cols} gap-4 mb-8`}>
      {items.map((s, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-gray-600 text-sm">{s.label}</p>
          <p className={`text-2xl font-bold mt-1 ${s.color || 'text-gray-900'}`}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}
