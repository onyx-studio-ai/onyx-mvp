const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // C2PA 原生模組(neon binary)不能被 bundler 打包,必須留在 node_modules 由 runtime 載入
  serverExternalPackages: ['@contentauth/c2pa-node'],
  turbopack: {
    root: __dirname,
  },
  outputFileTracingRoot: __dirname,
  poweredByHeader: false,
  // Invisible-to-users security headers (no SEO / functional impact):
  // anti-MIME-sniffing, sane referrer policy, anti-clickjacking (same-origin
  // embedding still allowed). No CSP/Permissions-Policy here on purpose —
  // those can break scripts / the mic-based voice tools.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      // 後台/配音員頁殼禁止 CDN+瀏覽器快取(2026-07-18 根因:Vercel CDN 對 admin 頁
      // 殼留了部署前的舊版,Wing 連無痕都拿到舊 JS,新功能永遠看不到)。
      // 只擋 HTML 殼;chunks 本身帶 hash 不受影響,對外行銷頁照常快取。
      ...['/:locale/admin/:path*', '/:locale/admin', '/:locale/talent/:path*', '/:locale/talent', '/:locale/dashboard/:path*', '/:locale/dashboard'].map((source) => ({
        source,
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      })),
    ];
  },
  // 對外分享的公開檔案走自家域名(www.onyxstudios.ai/files/...),不露 supabase 網址
  // (2026-07-22 Wing:supabase 裸網址看起來次等)。只轉發 public storage;私有
  // bucket 仍走 signed URL 不經此路。
  async rewrites() {
    return [
      {
        source: '/files/:path*',
        destination: 'https://hnblwckpnapsdladcjql.supabase.co/storage/v1/object/public/:path*',
      },
    ];
  },
  typescript: {
    // 型別守門已恢復:2026-07-04 清掉最後 3 個型別債、全專案 tsc 0 錯誤後翻回 false。
    // 型別壞掉的 code 會被 build 擋下 —— 對「用 GitHub API 部署、沒本地 build」的
    // 流程尤其重要,Vercel 的 type-check 從此才是真的安全網。
    ignoreBuildErrors: false,
  },
};

module.exports = withNextIntl(nextConfig);
