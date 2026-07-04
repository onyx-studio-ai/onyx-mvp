const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
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
