'use client';

// Post-completion review widget (Fiverr-style), used on both the client order page
// (rating the talent) and the talent's won case (rating the client). Self-contained:
// pulls its own session token + locale. Multi-dimension star ratings + a guided
// comment. Double-blind: the counterpart's review is only shown once BOTH sides have
// reviewed (or 14 days pass) — the API enforces this; here we just render what it
// returns + a "sealed" hint.

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { supabase } from '@/lib/supabase';

function Stars({ value, onPick }: { value: number; onPick?: (n: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onPick} onClick={() => onPick?.(n)}
          className={`text-lg leading-none ${n <= value ? 'text-amber-400' : 'text-gray-600'} ${onPick ? 'hover:text-amber-300 cursor-pointer' : 'cursor-default'}`}>★</button>
      ))}
    </div>
  );
}

type Rev = { rating: number; comment: string | null; rating_communication?: number | null; rating_quality?: number | null; rating_delivery?: number | null };

export default function ReviewBox({ orderId, myType }: { orderId: string; myType: 'client' | 'talent' }) {
  const locale = useLocale();
  const isZh = locale.startsWith('zh'); const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  // The three sub-rating dimensions, labelled by who's reviewing whom.
  const DIMS: { key: 'rating_communication' | 'rating_quality' | 'rating_delivery'; label: string }[] = myType === 'client'
    ? [
        { key: 'rating_communication', label: tx('溝通配合', '沟通配合', 'Communication') },
        { key: 'rating_quality', label: tx('配音品質', '配音品质', 'Voice quality') },
        { key: 'rating_delivery', label: tx('準時交付', '准时交付', 'On-time delivery') },
      ]
    : [
        { key: 'rating_communication', label: tx('溝通配合', '沟通配合', 'Communication') },
        { key: 'rating_quality', label: tx('需求清楚', '需求清楚', 'Clear brief') },
        { key: 'rating_delivery', label: tx('付款準時', '付款准时', 'Prompt payment') },
      ];
  const target = myType === 'client' ? tx('配音員', '配音员', 'the talent') : tx('客戶', '客户', 'the client');

  const [token, setToken] = useState('');
  const [mine, setMine] = useState<Rev | null | undefined>(undefined); // undefined = loading
  const [theirs, setTheirs] = useState<Rev | null>(null);
  const [theirsHidden, setTheirsHidden] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const tk = data.session?.access_token || '';
    setToken(tk);
    if (!tk) { setMine(null); return; }
    const r = await fetch(`/api/marketplace/reviews?order_id=${orderId}&as=${myType}`, { headers: { Authorization: `Bearer ${tk}` } });
    const j = await r.json().catch(() => ({}));
    setMine((j.mine as Rev) || null);
    setTheirs((j.theirs as Rev) || null);
    setTheirsHidden(!!j.theirsHidden);
  }, [orderId, myType]);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!DIMS.some((d) => scores[d.key])) { setErr(tx('請至少點選一項星等', '请至少点选一项星等', 'Rate at least one item')); return; }
    setBusy(true); setErr('');
    const r = await fetch('/api/marketplace/reviews', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ order_id: orderId, reviewer_type: myType, comment, rating_communication: scores.rating_communication, rating_quality: scores.rating_quality, rating_delivery: scores.rating_delivery }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error || tx('送出失敗', '送出失败', 'Failed')); return; }
    await load();
  };

  if (mine === undefined) return null; // loading

  const ratingLine = (rev: Rev) => (
    <div className="space-y-0.5">
      <Stars value={rev.rating} />
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
        {DIMS.map((d) => rev[d.key] != null && <span key={d.key}>{d.label} {rev[d.key]}★</span>)}
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      {/* Counterpart's review of me — only once revealed (double-blind) */}
      {theirs ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
          <p className="text-[11px] text-gray-500 mb-1">{myType === 'client' ? tx('配音員給您的評價', '配音员给您的评价', 'The talent reviewed you') : tx('客戶給您的評價', '客户给您的评价', 'The client reviewed you')}</p>
          {ratingLine(theirs)}
          {theirs.comment && <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap">{theirs.comment}</p>}
        </div>
      ) : theirsHidden ? (
        <p className="text-[11px] text-gray-500">🔒 {tx('對方已評價,雙方都完成後一起公開(防止互相影響)。', '对方已评价,双方都完成后一起公开(防止互相影响)。', 'They\'ve reviewed — both reviews unseal together once you submit yours.')}</p>
      ) : null}

      {mine ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
          <p className="text-[11px] text-gray-500 mb-1">{tx('您給的評價', '您给的评价', 'Your review')}</p>
          {ratingLine(mine)}
          {mine.comment && <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap">{mine.comment}</p>}
          <p className="text-[11px] text-gray-500 mt-1.5">{tx('評價會在雙方都完成、或 14 天後公開。', '评价会在双方都完成、或 14 天后公开。', 'Reviews unseal once both sides finish, or after 14 days.')}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-3 space-y-2.5">
          <p className="text-sm font-medium text-amber-200">{tx(`評價 ${target}`, `评价 ${target}`, `Review ${target}`)}</p>
          {DIMS.map((d) => (
            <div key={d.key} className="flex items-center justify-between gap-3">
              <span className="text-xs text-gray-300">{d.label}</span>
              <Stars value={scores[d.key] || 0} onPick={(n) => setScores((s) => ({ ...s, [d.key]: n }))} />
            </div>
          ))}
          <textarea value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder={myType === 'client'
              ? tx('分享這次合作:音質、語氣、溝通、是否準時…(選填)', '分享这次合作:音质、语气、沟通、是否准时…(选填)', 'Share details: sound quality, tone, communication, on-time? (optional)')
              : tx('分享這次合作:需求是否清楚、溝通、付款…(選填)', '分享这次合作:需求是否清楚、沟通、付款…(选填)', 'Share details: clear brief, communication, payment? (optional)')}
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 min-h-[56px] resize-y focus:outline-none focus:border-amber-400/50" />
          {err && <p className="text-xs text-red-400">{err}</p>}
          <button onClick={submit} disabled={busy} className="rounded-lg px-4 py-1.5 text-sm disabled:opacity-50" style={{ color: '#1a160c', background: 'linear-gradient(180deg,#E4CB94,#C9A86A)', fontWeight: 700 }}>
            {busy ? tx('送出中…', '送出中…', '…') : tx('送出評價', '送出评价', 'Submit review')}
          </button>
          <p className="text-[11px] text-gray-500">{tx('雙盲評價:對方看不到你的評分,直到他也評價或 14 天後。', '双盲评价:对方看不到你的评分,直到他也评价或 14 天后。', 'Double-blind: hidden from them until they review too, or 14 days pass.')}</p>
        </div>
      )}
    </div>
  );
}
