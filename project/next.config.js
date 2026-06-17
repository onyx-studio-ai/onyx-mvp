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
    // TODO: flip to false after we've held 0 TS errors for a week.
    // We're at 0 errors today (2026-05-18) but this still allows
    // builds to silently ship type-broken code.
    ignoreBuildErrors: true,
  },
};

module.exports = withNextIntl(nextConfig);
