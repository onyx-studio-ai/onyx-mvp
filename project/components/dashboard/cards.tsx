'use client';

/*
  Shared dashboard "module" cards — the glass-panel look from the client 我的專案
  (StatsCard + order card). Extracted so the talent 案件機會 and client 配音需求
  lists render with the same module instead of one-off styles. Presentational only
  (pass strings in) so it works in both the next-intl dashboard and the tx()-based
  casting pages.
*/

import { Link } from '@/i18n/navigation';
import type { LucideIcon } from 'lucide-react';

type Accent = 'blue' | 'green' | 'amber' | 'sky' | 'gray' | 'violet';
const ACCENT: Record<Accent, { sq: string; ic: string; hover: string }> = {
  blue: { sq: 'bg-blue-500/10 border-blue-500/20', ic: 'text-blue-400', hover: 'hover:border-white/[0.12]' },
  green: { sq: 'bg-green-500/10 border-green-500/20', ic: 'text-green-400', hover: 'hover:border-green-500/25' },
  amber: { sq: 'bg-amber-500/10 border-amber-500/20', ic: 'text-amber-400', hover: 'hover:border-amber-500/25' },
  sky: { sq: 'bg-sky-500/10 border-sky-500/20', ic: 'text-sky-400', hover: 'hover:border-sky-500/25' },
  gray: { sq: 'bg-white/[0.05] border-white/10', ic: 'text-gray-400', hover: 'hover:border-white/[0.12]' },
  violet: { sq: 'bg-violet-500/10 border-violet-500/20', ic: 'text-violet-400', hover: 'hover:border-violet-500/25' },
};

/** A headline stat tile (專案總數 / 進行中 / 已完成 style). */
export function StatModule({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] p-5">
      <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -translate-y-8 translate-x-8" />
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-lg bg-white/[0.05]"><Icon className="w-4 h-4 text-gray-400" /></div>
        <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

/** The horizontal mini-fact pills row (語言 / 內容用途 / 語調 / 授權範圍 style). */
export function InfoPills({ items, cols = 4 }: { items: { label: string; value: React.ReactNode }[]; cols?: 2 | 3 | 4 }) {
  if (!items.length) return null;
  const c = cols === 2 ? 'sm:grid-cols-2' : cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-4';
  return (
    <div className={`grid grid-cols-2 ${c} gap-3`}>
      {items.map((it, i) => (
        <div key={i} className="rounded-lg bg-white/[0.02] px-3 py-2 min-w-0">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{it.label}</p>
          <p className="text-white text-xs font-medium truncate">{it.value}</p>
        </div>
      ))}
    </div>
  );
}

/** The card shell: colored icon square + code/title + status badge, optional body + footer.
    Renders as a Link when href is set, a button when onClick is set, else a plain panel. */
export function EntityCard({
  icon: Icon, accent = 'blue', code, title, badge, href, onClick, children, footer,
}: {
  icon: LucideIcon; accent?: Accent; code?: React.ReactNode; title: React.ReactNode; badge?: React.ReactNode;
  href?: string; onClick?: () => void; children?: React.ReactNode; footer?: React.ReactNode;
}) {
  const a = ACCENT[accent];
  const inner = (
    <div className={`group relative overflow-hidden rounded-xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] ${a.hover} transition-all duration-300 ${href || onClick ? 'cursor-pointer' : ''}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`p-2.5 rounded-lg border mt-0.5 shrink-0 ${a.sq}`}><Icon className={`w-4 h-4 ${a.ic}`} /></div>
            <div className="min-w-0">
              {code && <p className="text-gray-500 text-xs font-mono mb-0.5 truncate">{code}</p>}
              <h3 className="text-white font-semibold text-sm leading-snug">{title}</h3>
            </div>
          </div>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
        {children}
        {footer && <div className="flex items-center justify-end gap-2 pt-3 mt-3 border-t border-white/[0.04]">{footer}</div>}
      </div>
    </div>
  );
  if (href) return <Link href={href} className="block">{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className="block w-full text-left">{inner}</button>;
  return inner;
}
