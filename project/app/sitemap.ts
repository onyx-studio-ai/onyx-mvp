import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';

const BASE_URL = 'https://www.onyxstudios.ai';
const PRELAUNCH_MODE = process.env.PRELAUNCH_MODE === 'true' || process.env.VERCEL_ENV === 'preview';
const publicRoutes = [
  '/',
  '/about',
  '/contact',
  '/voice',
  '/voices',
  '/music',
  '/music/pricing',
  '/music/orchestra',
  '/pricing',
  '/dubbing',
  '/apply',
  '/legal/privacy',
  '/legal/terms',
  '/legal/aup',
  '/legal/refund',
] as const;

function toLocalePath(locale: string, route: string) {
  if (locale === routing.defaultLocale) {
    return route;
  }
  return route === '/' ? `/${locale}` : `/${locale}${route}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  if (PRELAUNCH_MODE) {
    return [];
  }

  const now = new Date();

  return publicRoutes.flatMap((route) =>
    routing.locales.map((locale) => ({
      url: `${BASE_URL}${toLocalePath(locale, route)}`,
      lastModified: now,
      changeFrequency: route === '/' ? 'daily' : 'weekly',
      priority: route === '/' ? 1 : route === '/pricing' || route === '/music/pricing' ? 0.9 : 0.7,
    }))
  );
}
