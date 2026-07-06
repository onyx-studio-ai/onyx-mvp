'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';

/**
 * 前台流量埋點(client) — 掛在 [locale]/layout 裡,每次頁面 / 路由變化記一筆。
 *
 * 為什麼走 client + /api/track(而非 middleware):
 *   - Vercel 上最穩:middleware 跑 Edge runtime,用 node supabase-js 寫 DB 不穩,
 *     且它在每個請求同步執行,失敗會影響回應。client beacon 完全非阻塞。
 *   - navigator.sendBeacon 是瀏覽器為「離開頁面時送統計」設計的:非阻塞、不等回應、
 *     不因導頁被取消。取不到 sendBeacon 時退回 fetch keepalive。
 *
 * 排除 / 去重:
 *   - /admin、/api 等在伺服器端 /api/track 也會再擋一次(雙保險)。
 *   - lastPath ref 確保「同一路徑」只記一筆,避免 React 重繪 / effect 重跑重複送。
 *
 * 隱私:只送 path(已去 locale 前綴) / locale / document.referrer。無任何個資。
 */
export default function PageViewTracker() {
  const pathname = usePathname();
  const locale = useLocale();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    // 後台頁面不算流量(前端先擋,伺服器端再擋一次)。
    if (pathname === '/admin' || pathname.startsWith('/admin/')) return;
    // 同一路徑只記一筆。
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;

    const payload = JSON.stringify({
      path: pathname,
      locale,
      referrer: typeof document !== 'undefined' ? document.referrer : '',
    });

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/track', blob);
      } else {
        // 退路:keepalive fetch,同樣非阻塞,錯誤吞掉。
        void fetch('/api/track', {
          method: 'POST',
          body: payload,
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // 埋點永遠不能影響頁面 — 靜默失敗。
    }
  }, [pathname, locale]);

  return null;
}
