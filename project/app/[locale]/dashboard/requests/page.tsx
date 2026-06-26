'use client';

/*
  客戶後台「配音需求 / 我的發案」— the voiceover requests this client submitted via
  /hire, with live status + an audition count. Lives in the existing client area
  (/dashboard) alongside Projects/Invoices/Settings. Read-only (talent selection
  comes later). Auth + chrome come from the dashboard layout.
*/

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { supabase } from '@/lib/supabase';
import { caseCode } from '@/lib/casting';

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

  const statusInfo = (s: string, count: number): { label: string; cls: string; note: string } => {
    switch (s) {
      case 'reviewing': return { label: tx('審核中', '审核中', 'In review'), cls: 'bg-amber-500/15 text-amber-200 border-amber-500/30', note: tx('Onyx 正在確認您的需求,很快回覆。', 'Onyx 正在确认您的需求,很快回复。', 'Onyx is reviewing your request.') };
      case 'open': return { label: tx('徵選中', '征选中', 'Auditioning'), cls: 'bg-green-500/15 text-green-200 border-green-500/30', note: count ? tx(`${count} 位配音員已試音`, `${count} 位配音员已试音`, `${count} talent(s) auditioned`) : tx('已開放配音員試音。', '已开放配音员试音。', 'Open for auditions.') };
      case 'awarded': return { label: tx('已選定', '已选定', 'Awarded'), cls: 'bg-sky-500/15 text-sky-200 border-sky-500/30', note: tx('已為這個案選定配音員。', '已为这个案选定配音员。', 'A talent has been selected.') };
      case 'closed': return { label: tx('已結束', '已结束', 'Closed'), cls: 'bg-white/10 text-gray-300 border-white/15', note: '' };
      case 'cancelled': return { label: tx('已取消', '已取消', 'Cancelled'), cls: 'bg-white/10 text-gray-400 border-white/15', note: '' };
      default: return { label: s, cls: 'bg-white/10 text-gray-300 border-white/15', note: '' };
    }
  };

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto text-white">
      <div className="flex items-center justify-between mb-2 gap-3">
        <h1 className="text-2xl font-semibold">{tx('配音需求', '配音需求', 'Voiceover requests')}</h1>
        <Link href="/hire" className="text-xs bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg px-3 py-1.5">{tx('+ 發新需求', '+ 发新需求', '+ New request')}</Link>
      </div>
      <p className="text-gray-500 text-sm mb-8">{tx('您透過官網送出的配音需求與目前進度。', '您通过官网送出的配音需求与目前进度。', 'The requests you submitted and their current status.')}</p>

      {phase === 'loading' && <p className="text-gray-500 text-sm py-10">{tx('載入中…', '加载中…', 'Loading…')}</p>}

      {phase === 'ready' && briefs.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-500 text-sm mb-4">{tx('您還沒有發過配音需求。', '您还没有发过配音需求。', 'No requests yet.')}</p>
          <Link href="/hire" className="text-amber-300 hover:underline text-sm">{tx('前往發案 →', '前往发案 →', 'Post a request →')}</Link>
        </div>
      )}

      <div className="space-y-3">
        {briefs.map((b) => {
          const st = statusInfo(b.status, counts[b.id] || 0);
          return (
            <Link key={b.id} href={`/dashboard/requests/${b.id}`} className="block bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 hover:border-white/20 rounded-2xl p-5 transition">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <span className="text-xs text-gray-500 font-mono">{b.kind === 'casting' ? caseCode(b) : b.brief_number}</span>
                  <h3 className="text-lg font-semibold text-white leading-snug">{b.title || `${b.content_type || tx('配音', '配音', 'Voiceover')}${tx('需求', '需求', ' request')}`}</h3>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full border whitespace-nowrap shrink-0 ${st.cls}`}>{st.label}</span>
              </div>
              {st.note && <p className="text-xs text-gray-400 mb-2">{st.note}</p>}
              <p className="text-sm text-gray-300 whitespace-pre-wrap line-clamp-3 mb-3">{b.brief}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                {b.content_type && <span>{b.content_type}</span>}
                {b.language && <span>{b.language}</span>}
                {b.budget && <span>{tx('預算', '预算', 'Budget')} {b.budget_type ? `${b.budget_type} ` : ''}{b.budget}</span>}
                {b.audition_deadline && <span>{tx('試音截止', '试音截止', 'Audition')} {b.audition_deadline}</span>}
                {b.deadline && <span>{tx('交付截止', '交付截止', 'Delivery')} {b.deadline}</span>}
                <span className="ml-auto text-amber-300/70">{tx('查看 / 編輯 →', '查看 / 编辑 →', 'View / edit →')}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
