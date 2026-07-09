import { routing } from '@/i18n/routing';

/*
  Shared SEO helpers for content pages. Many pages are client components ('use
  client') and therefore can't export metadata themselves — their metadata lives
  in a sibling server `layout.tsx` that calls pageMetadata() from here. Mirrors the
  inline `serviceAlternates` used by the existing service pages (voice/dubbing/…),
  centralised so we don't copy it into every new page.
*/

const OG_IMAGE = { url: '/logo-og.png', width: 1200, height: 1200, alt: 'Onyx Studios' };

// canonical + hreflang for a route so Google tells the three locale versions apart
// instead of treating them as duplicates. The default locale carries no prefix.
export function localeAlternates(locale: string, route: string) {
  const canonical = locale === routing.defaultLocale ? route : `/${locale}${route}`;
  const languages = Object.fromEntries(
    routing.locales.map((lang) => [lang, lang === routing.defaultLocale ? route : `/${lang}${route}`]),
  );
  return { canonical, languages: { ...languages, 'x-default': route } };
}

// Full metadata for a content page: title/description (already resolved from the
// `meta` namespace) + canonical/hreflang + OG/Twitter. Pass withAlternates:false
// for a route that has sub-routes WITHOUT their own metadata, otherwise those
// children inherit this canonical (which would be wrong for them).
export function pageMetadata(opts: { locale: string; route: string; title: string; description: string; withAlternates?: boolean }) {
  const alternates = opts.withAlternates === false ? undefined : localeAlternates(opts.locale, opts.route);
  return {
    title: opts.title,
    description: opts.description,
    ...(alternates ? { alternates } : {}),
    openGraph: {
      type: 'website' as const,
      siteName: 'Onyx Studios',
      title: opts.title,
      description: opts.description,
      ...(alternates ? { url: alternates.canonical } : {}),
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: opts.title,
      description: opts.description,
      images: [OG_IMAGE],
    },
  };
}
