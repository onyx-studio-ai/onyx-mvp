'use client';

// Post-completion review widget, used on both the client order page (rating the
// talent) and the talent's won case (rating the client). Self-contained: pulls its
// own session token + locale, checks whether this side already reviewed, then shows
// either the saved review or a star + comment form.

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { supabase } from '@/lib/supabase';

function Stars({ value, onPick }: { value: number; onPick?: (n: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onPick} onClick={() => onPick?.(n)}
          className={`text-xl leading-none ${n <= value ? 'text-amber-400' : 'text-gray-600'} ${onPick ? 'hover:text-amber-300 cursor-pointer' : 'cursor-default'}`}>★</button>
      ))}
    </div>
  );
}

export default function ReviewBox({ orderId, myType, targetLabel }: {
  orderId: string; myType: 'client' | 'talent'; targetLabel?: string;
}) {
  const locale = useLocale();
  const isZh = locale.startsWith('zh'); const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);
  const target = targetLabel || (myType === 'client' ? tx('配音員', '配音员', 'the talent') : tx('客戶', '客户', 'the client'));

  type Rev = { rating: number; comment: string | null };
  const [token, setToken] = useState('');
  const [existing, setExisting] = useState<Rev | null | undefined>(undefined); // my review
  const [theirs, setTheirs] = useState<Rev | null>(null);                       // counterpart's review of me
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const otherType = myType === 'client' ? 'talent' : 'client';

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const tk = data.session?.access_token || '';
    setToken(tk);
    if (!tk) { setExisting(null); return; }
    const r = await fetch(`/api/marketplace/reviews?order_id=${orderId}`, { headers: { Authorization: `Bearer ${tk}` } });
    const j = await r.json().catch(() => ({}));
    setExisting((j[myType] as Rev) || null);
    setTheirs((j[otherType] as Rev) || null);
  }, [orderId, myType, otherType]);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!rating) { setErr(tx('請點選星等', '请点选星等', 'Pick a rating')); return; }
    setBusy(true); setErr('');
    const r = await fetch('/api/marketplace/reviews', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ order_id: orderId, rating, comment, reviewer_type: myType }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error || tx('送出失敗', '送出失败', 'Failed')); return; }
    setExisting({ rating, comment: comment.trim() || null });
  };

  if (existing === undefined) return null; // loading

  // Whatever the counterpart wrote about me — shown in my backstage either way.
  const theirsLabel = myType === 'client'
    ? tx('配音員給您的評價', '配音员给您的评价', 'The talent reviewed you')
    : tx('客戶給您的評價', '客户给您的评价', 'The client reviewed you');
  const theirsBlock = theirs ? (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <p className="text-[11px] text-gray-500 mb-1">{theirsLabel}</p>
      <Stars value={theirs.rating} />
      {theirs.comment && <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap">{theirs.comment}</p>}
    </div>
  ) : null;

  return (
    <div className="space-y-2">
      {theirsBlock}
      {existing ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
          <p className="text-[11px] text-gray-500 mb-1">{tx('您給的評價', '您给的评价', 'Your review')}</p>
          <Stars value={existing.rating} />
          {existing.comment && <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap">{existing.comment}</p>}
        </div>
      ) : (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-3 space-y-2">
          <p className="text-sm font-medium text-amber-200">{tx(`評價 ${target}`, `评价 ${target}`, `Review ${target}`)}</p>
          <Stars value={rating} onPick={setRating} />
          <textarea value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder={tx('這次合作如何?(選填)', '这次合作如何?(选填)', 'How was working together? (optional)')}
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 min-h-[56px] resize-y focus:outline-none focus:border-amber-400/50" />
          {err && <p className="text-xs text-red-400">{err}</p>}
          <button onClick={submit} disabled={busy} className="rounded-lg px-4 py-1.5 text-sm disabled:opacity-50" style={{ color: '#1a160c', background: 'linear-gradient(180deg,#E4CB94,#C9A86A)', fontWeight: 700 }}>
            {busy ? tx('送出中…', '送出中…', '…') : tx('送出評價', '送出评价', 'Submit review')}
          </button>
        </div>
      )}
    </div>
  );
}
