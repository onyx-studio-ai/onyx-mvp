import { cache } from 'react';
import type { Metadata } from 'next';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { routing } from '@/i18n/routing';
import { pickLocale } from '@/lib/i18n-pick';
import { baseLangLabel } from '@/lib/talent-taxonomy';

/*
  SSR metadata + Person JSON-LD for the public talent profile at /talents/[id].
  The profile page itself stays a client component (unchanged) — this server
  layout only adds head/meta + schema so the ~1,500 sitemap'd talent pages get
  rich share cards and can rank for "Taiwan voice actor / Cantonese voice actor"
  style long-tail queries instead of colliding with the homepage's metadata.

  Public-safe by construction: we read ONLY the admin-approved published_snapshot
  (built server-side from a public field whitelist in /api/admin/talents/publish),
  exactly like /api/talents/roster and the sitemap. Email / phone / payment /
  auth_user_id can never leak here. Draft / unpublished talents have no snapshot →
  we emit noindex + a generic title so nothing draft-y reaches Google.
*/

const BASE_URL = 'https://www.onyxstudios.ai';

type PublicTalent = {
  name?: string;
  name_i18n?: Record<string, string>;
  bio?: string | Record<string, string>;
  languages?: string[];
  headshot_url?: string;
  location?: string;
  gender?: string;
};

// Cached per-request: generateMetadata and the layout body both need the same
// snapshot, so cache() collapses them into a single Supabase read per render.
const getPublicTalent = cache(async (id: string): Promise<PublicTalent | null> => {
  // Bad/partial ids (not a uuid) shouldn't hit the DB with a malformed filter.
  if (!id || !/^[0-9a-fA-F-]{8,}$/.test(id)) return null;
  try {
    const db = getSupabaseServiceClient();
    // EXACT public filter mirror of /api/talents/roster + sitemap: active, real
    // humans, admin-published only. The record we expose IS the snapshot.
    const { data, error } = await db
      .from('talents')
      .select('published_snapshot')
      .eq('id', id)
      .eq('is_active', true)
      .in('type', ['VO', 'voice_actor'])
      .not('application_id', 'is', null)
      .not('published_snapshot', 'is', null)
      .maybeSingle();
    if (error || !data?.published_snapshot) return null;
    return data.published_snapshot as PublicTalent;
  } catch {
    // Fail soft — a DB hiccup should fall back to noindex, never throw the page.
    return null;
  }
});

// bio may be a plain string (legacy) or {locale:text}; take a locale-appropriate
// slice for the meta description and collapse whitespace.
function bioSummary(bio: PublicTalent['bio'], locale: string, max = 155): string {
  const raw = pickLocale(bio, locale).replace(/\s+/g, ' ').trim();
  if (raw.length <= max) return raw;
  return raw.slice(0, max - 1).trimEnd() + '…';
}

function localePath(locale: string, path: string) {
  return locale === routing.defaultLocale ? path : `/${locale}${path}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getPublicTalent(id);

  // Draft / unpublished / not found → don't feed Google a bare or draft page.
  if (!t) {
    return { title: 'Voice Talent | Onyx Studios', robots: { index: false, follow: true } };
  }

  const name = pickLocale(t.name_i18n, locale) || t.name || 'Voice Talent';
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  // Localized, de-duped language names for the title/description (English names
  // for the English page — "Cantonese / Mandarin" — are the search keywords
  // international clients type; zh pages get 粵語 / 國語).
  const langList = Array.from(
    new Set((t.languages || []).map((l) => baseLangLabel(l.split('/')[0], locale)).filter(Boolean)),
  );
  const langListEn = Array.from(
    new Set((t.languages || []).map((l) => baseLangLabel(l.split('/')[0], 'en')).filter(Boolean)),
  );

  // Title: talent name + a client-friendly, keyword-bearing role line. English
  // carries "Voice Actor" + the language names international clients search on.
  const roleWord = tx('配音員', '配音员', 'Voice Actor');
  const roleLine = isZh
    ? `${langList.join(' / ')}${langList.length ? ' ' : ''}${roleWord}`.trim()
    : `${langListEn.join(' / ')}${langListEn.length ? ' ' : ''}Voice Actor`.trim();
  const title = `${name} · ${roleLine || roleWord} | Onyx Studios`;

  const bio = bioSummary(t.bio, locale);
  const description = bio
    || tx(
      `${name} — Onyx Studios 配音陣容。試聽 demo、了解可配語言與專長,直接指定發案。`,
      `${name} — Onyx Studios 配音阵容。试听 demo、了解可配语言与专长,直接指定发案。`,
      `${name} — professional voice actor at Onyx Studios${langList.length ? `, working in ${langList.join(', ')}` : ''}. Listen to demos and request this talent.`,
    );

  const path = `/talents/${id}`;
  const canonical = localePath(locale, path);
  const languages = Object.fromEntries(
    routing.locales.map((lang) => [lang, localePath(lang, path)]),
  );
  const ogImage = t.headshot_url
    ? [{ url: t.headshot_url, alt: name }]
    : [{ url: '/logo-og.png', width: 1200, height: 1200, alt: name }];

  return {
    title,
    description,
    alternates: { canonical, languages: { ...languages, 'x-default': path } },
    openGraph: {
      type: 'profile' as const,
      siteName: 'Onyx Studios',
      title: `${name} · ${roleLine || roleWord}`,
      description,
      url: canonical,
      images: ogImage,
    },
    twitter: {
      card: t.headshot_url ? ('summary' as const) : ('summary_large_image' as const),
      title: `${name} · ${roleLine || roleWord}`,
      description,
      images: ogImage.map((i) => i.url),
    },
  };
}

export default async function TalentProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const t = await getPublicTalent(id); // cached — no extra DB round-trip.

  // Person schema only for published talents (draft pages are noindex anyway).
  let personLd: string | null = null;
  if (t) {
    const name = t.name_i18n?.en || t.name || pickLocale(t.name_i18n, 'en') || 'Voice Talent';
    const knowsLanguage = Array.from(
      new Set((t.languages || []).map((l) => baseLangLabel(l.split('/')[0], 'en')).filter(Boolean)),
    );
    const person: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name,
      jobTitle: 'Voice Actor',
      url: `${BASE_URL}/talents/${id}`,
      worksFor: { '@type': 'Organization', name: 'Onyx Studios', url: BASE_URL },
    };
    if (t.headshot_url) person.image = t.headshot_url;
    if (knowsLanguage.length) person.knowsLanguage = knowsLanguage;
    if (t.location) person.homeLocation = { '@type': 'Place', name: t.location };
    // 安全審計 M-3:跳脫 `<` 防止 name/location 內含 `</script>` 造成儲存型 XSS
    personLd = JSON.stringify(person).replace(/</g, '\\u003c');
  }

  return (
    <>
      {personLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: personLd }} />
      )}
      {children}
    </>
  );
}
