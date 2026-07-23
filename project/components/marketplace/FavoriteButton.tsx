'use client';

// Heart toggle to add/remove a talent from the logged-in user's shortlist (收藏).
// Self-contained: drop <FavoriteButton talentId={t.id} /> anywhere. All buttons on
// a page share ONE fetch of the user's favorite set (cached at module scope) and
// subscribe to changes, so a list of 50 talents doesn't make 50 requests.

import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { authedFetch } from '@/lib/authed-fetch';

let cache: Set<string> | null = null; // null = not loaded yet
let loading: Promise<void> | null = null;
let signedIn = false; // 只記「有沒有登入」;token 不快取(整個瀏覽階段共用舊 token 會過期 401),請求走 authedFetch 即時取
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function ensureLoaded() {
  if (cache || loading) return loading || Promise.resolve();
  loading = (async () => {
    const { data } = await supabase.auth.getSession();
    signedIn = !!data.session?.access_token;
    cache = new Set();
    if (signedIn) {
      const r = await authedFetch('/api/favorites');
      const j = await r.json().catch(() => ({}));
      if (Array.isArray(j.ids)) cache = new Set(j.ids as string[]);
    }
    emit();
  })();
  return loading;
}

export default function FavoriteButton({ talentId, size = 18, className = '' }: { talentId: string; size?: number; className?: string }) {
  const [, force] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    ensureLoaded();
    return () => { listeners.delete(l); };
  }, []);

  const fav = !!cache?.has(talentId);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation(); // don't trigger the card's link
    if (!signedIn) { window.location.href = '/auth'; return; } // prompt sign-in
    if (busy || !cache) return;
    setBusy(true);
    if (fav) {
      cache.delete(talentId); emit();
      await authedFetch(`/api/favorites?talent_id=${talentId}`, { method: 'DELETE' }).catch(() => {});
    } else {
      cache.add(talentId); emit();
      await authedFetch('/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ talent_id: talentId }) }).catch(() => {});
    }
    setBusy(false);
  }

  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={fav}
      title={fav ? '已收藏 — 點擊移除' : '收藏'}
      className={`inline-flex items-center justify-center rounded-full p-1.5 transition ${fav ? 'text-rose-400' : 'text-gray-400 hover:text-rose-300'} ${className}`}>
      <Heart size={size} fill={fav ? 'currentColor' : 'none'} />
    </button>
  );
}
