import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { getAllPosts } from '@/lib/blog/posts';

const BASE_URL = 'https://www.onyxstudios.ai';
const PRELAUNCH_MODE = process.env.PRELAUNCH_MODE === 'true' || process.env.VERCEL_ENV === 'preview';
const publicRoutes = [
  '/',
  '/about',
  '/faq',
  '/contact',
  '/voice',
  '/voices',
  '/music',
  '/music/pricing',
  '/music/orchestra',
  '/pricing',
  '/dubbing',
  '/data',
  '/apply',
  '/legal/privacy',
  '/legal/terms',
  '/legal/aup',
  '/legal/refund',
  '/tools',
  '/blog',
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

  const staticEntries = publicRoutes.flatMap((route) =>
    routing.locales.map((locale) => ({
      url: `${BASE_URL}${toLocalePath(locale, route)}`,
      lastModified: now,
      changeFrequency: (route === '/' ? 'daily' : 'weekly') as 'daily' | 'weekly',
      priority: route === '/' ? 1 : route === '/pricing' || route === '/music/pricing' ? 0.9 : 0.7,
    }))
  );

  const blogEntries = getAllPosts().flatMap((post) =>
    routing.locales.map((locale) => ({
      url: `${BASE_URL}${toLocalePath(locale, `/blog/${post.slug}`)}`,
      lastModified: new Date(post.date + 'T00:00:00Z'),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    }))
  );

  return [...staticEntries, ...blogEntries];
}
