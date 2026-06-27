'use client';

/*
  客戶後台「配音需求 / 我的發案」— the voiceover requests this client submitted via
  /hire, with live status + an audition count. Lives in the existing client area
  (/dashboard) alongside Projects/Invoices/Settings. Uses the shared dashboard card
  module (StatModule / EntityCard / InfoPills) so it matches 我的專案. Auth + chrome
  come from the dashboard layout.
*/

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ClipboardList, Radio, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { caseCode } from '@/lib/casting';
import { StatModule, EntityCard, InfoPills } from '@/components/dashboard/cards';

type Brief = {
  id: string; brief_number: string; kind?: string | null; title?: string | null; content_type?: string | null;
  language?: string | null; status: string; budget?: string | null; budget_type?: string | null;
  audition_deadline?: string | null; deadline?: string | null; brief: string; created_at: string;
};

export default function ClientRequests() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  const [phase, setPhase] = useState<'loading' | 'ready'>('loading');
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setPhase('ready'); return; }
    const res = await fetch('/api/client/requests', { headers: { Authorization: `Bearer ${token}` } });
    const j = await res.json().catch(() => ({}));
    setBriefs(j.briefs || []);
    setCounts(j.counts || {});
    setPhase('ready');
  }, []);
  useEffect(() => { load(); }, [load]);

  const statusInfo = (s: string, count: number): { label: string; cls: string; note: string; accent: 'amber' | 'green' | 'sky' | 'gray' } => {
    switch (s) {
      case 'reviewing': return { label: tx('審核中', '审核中', 'In review'), cls: 'bg-amber-500/15 text-amber-200 border-amber-500/30', accent: 'amber', note: tx('Onyx 正在確認您的需求,很快回覆。', 'Onyx 正在确认您的需求,很快回复。', 'Onyx is reviewing your request.') };
      case 'open': return { label: tx('徵選中', '征选中', 'Auditioning'), cls: 'bg-green-500/15 text-green-200 border-green-500/30', accent: 'green', note: count ? tx(`${count} 位配音員已試音`, `${count} 位配音员已试音`, `${count} talent(s) auditioned`) : tx('已開放配音員試音。', '已开放配音员试音。', 'Open for auditions.') };
      case 'awarded': return { label: tx('已選定', '已选定', 'Awarded'), cls: 'bg-sky-500/15 text-sky-200 border-sky-500/30', accent: 'sky', note: tx('已為這個案選定配音員。', '已为这个案选定配音员。', 'A talent has been selected.') };
      case 'closed': return { label: tx('製作中', '制作中', 'In production'), cls: 'bg-sky-500/15 text-sky-200 border-sky-500/30', accent: 'sky', note: tx('已成立製作單,進入錄製。', '已成立制作单,进入录制。', 'A production order has been created.') };
      case 'cancelled': return { label: tx('已取消', '已取消', 'Cancelled'), cls: 'bg-white/10 text-gray-400 border-white/15', accent: 'gray', note: '' };
      default: return { label: s, cls: 'bg-white/10 text-gray-300 border-white/15', accent: 'gray', note: '' };
    }
  };

  const stats = {
    total: briefs.length,
    open: briefs.filter((b) => b.status === 'open').length,
    production: briefs.filter((b) => b.status === 'awarded' || b.status === 'closed').length,
  };

  return (
    <div className="text-white p-6 lg:p-10">
      <div className="max-w-5xl">
        <div className="flex items-start justify-between gap-3 mb-8">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2 font-medium">{tx('工作室入口', '工作室入口', 'Studio portal')}</p>
            <h1 className="text-3xl font-bold tracking-tight">{tx('配音需求', '配音需求', 'Voiceover requests')}</h1>
            <p className="text-gray-500 text-sm mt-1">{tx('您透過官網送出的配音需求與目前進度。', '您通过官网送出的配音需求与目前进度。', 'The requests you submitted and their current status.')}</p>
          </div>
          <Link href="/hire" className="text-xs bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg px-3 py-2 whitespace-nowrap shrink-0">{tx('+ 發新需求', '+ 发新需求', '+ New request')}</Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <StatModule icon={ClipboardList} label={tx('需求總數', '需求总数', 'Total requests')} value={stats.total} />
          <StatModule icon={Radio} label={tx('徵選中', '征选中', 'Auditioning')} value={stats.open} />
          <StatModule icon={Loader2} label={tx('製作中', '制作中', 'In production')} value={stats.production} />
        </div>

        {phase === 'loading' && (
          <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-600" /></div>
        )}

        {phase === 'ready' && briefs.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-500 text-sm mb-4">{tx('您還沒有發過配音需求。', '您还没有发过配音需求。', 'No requests yet.')}</p>
            <Link href="/hire" className="text-amber-300 hover:underline text-sm">{tx('前往發案 →', '前往发案 →', 'Post a request →')}</Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {briefs.map((b) => {
            const st = statusInfo(b.status, counts[b.id] || 0);
            const pills = [
              b.content_type ? { label: tx('類型', '类型', 'Type'), value: b.content_type } : null,
              b.language ? { label: tx('語言', '语言', 'Language'), value: b.language } : null,
              b.budget ? { label: tx('預算', '预算', 'Budget'), value: `${b.budget_type ? `${b.budget_type} ` : ''}${b.budget}` } : null,
              (b.audition_deadline || b.deadline) ? { label: tx('截止', '截止', 'Due'), value: b.audition_deadline || b.deadline } : null,
            ].filter(Boolean) as { label: string; value: React.ReactNode }[];
            return (
              <EntityCard
                key={b.id}
                icon={ClipboardList}
                accent={st.accent}
                href={`/dashboard/requests/${b.id}`}
                code={b.kind === 'casting' ? caseCode(b) : b.brief_number}
                title={b.title || `${b.content_type || tx('配音', '配音', 'Voiceover')}${tx('需求', '需求', ' request')}`}
                badge={<span className={`text-xs px-2.5 py-1 rounded-full border whitespace-nowrap ${st.cls}`}>{st.label}</span>}
                footer={<span className="text-xs text-amber-300/80">{tx('查看 / 編輯 →', '查看 / 编辑 →', 'View / edit →')}</span>}
              >
                {st.note && <p className="text-xs text-gray-400 mb-2">{st.note}</p>}
                <p className="text-sm text-gray-300 whitespace-pre-wrap line-clamp-2 mb-3">{b.brief}</p>
                <InfoPills items={pills} cols={4} />
              </EntityCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}
