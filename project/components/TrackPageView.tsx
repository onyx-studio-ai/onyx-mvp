'use client';

/*
  Pageview beacon —— 掛在 [locale]/layout.tsx 裡,所有前台頁都會經過。
  用 usePathname() 監看路徑變化,每次變化送一筆 pageview(帶 path + locale + 匿名 visitorId)。
  純 client(有 'use client' + 只在 effect 內動作),不會 SSR 報錯。
*/

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { track } from '@/lib/track';

export default function TrackPageView() {
  const pathname = usePathname();
  const locale = useLocale();

  useEffect(() => {
    if (!pathname) return;
    track('pageview', { path: pathname, locale });
  }, [pathname, locale]);

  return null;
}
