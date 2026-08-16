import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { getAllPosts } from '@/lib/blog/posts';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

// Revalidate hourly so scheduled blog posts (and newly-published talents) enter
// the sitemap on their date.
export const revalidate = 3600;

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

// hreflang group for a route → emitted by Next as <xhtml:link rel="alternate">, so
// Google links the three locale versions of a page instead of treating them as
// duplicates (this is how the homepage + every page gets its hreflang, without any
// head/page change). Each entry references all locales + x-default (default locale).
function languagesFor(route: string): Record<string, string> {
  const langs: Record<string, string> = {};
  for (const locale of routing.locales) langs[locale] = `${BASE_URL}${toLocalePath(locale, route)}`;
  langs['x-default'] = `${BASE_URL}${toLocalePath(routing.defaultLocale, route)}`;
  return langs;
}

// Public, published human voice talents → /talents/[id] long-tail landing pages.
// Mirrors the EXACT filter of the public /api/talents/roster endpoint so the
// sitemap and the browsable gallery stay in lockstep: active, real humans
// (VO / voice_actor with an application_id, never the manually-created AI
// catalogue), and only those with an admin-approved published_snapshot. We
// select id + updated_at ONLY — never the snapshot itself — so no PII is read
// here by construction. Fails soft: a DB hiccup must not blank the whole
// sitemap, so we drop talent rows and still emit static + blog entries.
async function getPublishedTalents(): Promise<{ id: string; updated_at: string | null }[]> {
  try {
    const db = getSupabaseServiceClient();
    const { data, error } = await db
      .from('talents')
      .select('id, updated_at')
      .eq('is_active', true)
      .in('type', ['VO', 'voice_actor'])
      .not('application_id', 'is', null)
      .not('published_snapshot', 'is', null)
      .order('sort_order', { ascending: true });
    if (error) {
      console.error('[sitemap] talents query failed:', error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.error('[sitemap] talents query threw:', err);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
      alternates: { languages: languagesFor(route) },
    }))
  );

  const blogEntries = getAllPosts().flatMap((post) =>
    routing.locales.map((locale) => ({
      url: `${BASE_URL}${toLocalePath(locale, `/blog/${post.slug}`)}`,
      lastModified: new Date(post.date + 'T00:00:00Z'),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
      alternates: { languages: languagesFor(`/blog/${post.slug}`) },
    }))
  );

  // ~1,500 talents × 3 locales ≈ 4,500 URLs — comfortably under Google's
  // 50k-per-file cap, so a single sitemap is fine. One entry per locale, each
  // carrying the hreflang group for its three language versions.
  const talentEntries = (await getPublishedTalents()).flatMap((t) =>
    routing.locales.map((locale) => ({
      url: `${BASE_URL}${toLocalePath(locale, `/talents/${t.id}`)}`,
      lastModified: t.updated_at ? new Date(t.updated_at) : now,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
      alternates: { languages: languagesFor(`/talents/${t.id}`) },
    }))
  );

  return [...staticEntries, ...blogEntries, ...talentEntries];
}
