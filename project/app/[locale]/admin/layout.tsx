import LayoutShell from './LayoutShell';

/*
  強制動態渲染(2026-07-18 治本):這區頁殼曾被 Vercel CDN prerender 快取,
  部署後 Wing 連無痕都拿到舊 JS(custom Cache-Control 對 prerender 會被 Vercel 覆寫)。
  force-dynamic = 沒有 prerender 產物可快取,每次請求都是現役 build 的殼。
  登入後才看得到的區域,殼的 TTFB 慢一點無所謂。
*/
export const dynamic = 'force-dynamic';

export default function Layout({ children }: { children: React.ReactNode }) {
  // 版本自證:側欄顯示執行中的 commit(除錯「使用者端到底跑哪版」不再用猜的)
  const buildTag = (process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7);
  return <LayoutShell buildTag={buildTag}>{children}</LayoutShell>;
}
