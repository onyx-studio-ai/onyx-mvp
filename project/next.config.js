const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  outputFileTracingRoot: __dirname,
  poweredByHeader: false,
  typescript: {
    // TODO: flip to false after we've held 0 TS errors for a week.
    // We're at 0 errors today (2026-05-18) but this still allows
    // builds to silently ship type-broken code.
    ignoreBuildErrors: true,
  },
};

module.exports = withNextIntl(nextConfig);
