'use client';

// AI 聲音分身計畫入口卡 —— 可見性由後端內測閘門決定(404 = 不顯示)。
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { authedFetch } from '@/lib/authed-fetch';
import { Sparkles } from 'lucide-react';

export default function AiTwinEntry({ tx }: { tx: (tw: string, cn: string, en: string) => string }) {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    authedFetch('/api/talent/ai-twin').then(async (r) => {
      if (r.ok) { setVisible(true); const j = await r.json().catch(() => ({})); setStatus(j.enrollment?.status || null); }
    }).catch(() => {});
  }, []);
  if (!visible) return null;
  return (
    <Link href="/talent/ai-twin" className="block bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-4 hover:bg-emerald-500/15 transition mb-4">
      <p className="text-sm font-medium text-emerald-200 flex items-center gap-2"><Sparkles className="w-4 h-4" />{tx('AI 聲音分身計畫', 'AI 声音分身计划', 'AI Voice Twin Program')}
        {status && <span className="text-[11px] bg-white/10 rounded-full px-2 py-0.5 text-gray-300">{status === 'submitted' ? tx('審核中', '审核中', 'In review') : status === 'approved' ? tx('已核准', '已核准', 'Approved') : status}</span>}
      </p>
      <p className="text-xs text-gray-400 mt-1">{tx('錄一組參考音,建立你的 AI 分身,每次被使用都分潤 25%。', '录一组参考音,建立你的 AI 分身,每次被使用都分润 25%。', 'Record once, earn 25% every time your AI voice is used.')}</p>
    </Link>
  );
}
