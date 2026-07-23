import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import Footer from '@/components/landing/Footer';
import { getPost, pick } from '@/lib/blog/posts';
import { ArrowRight, ArrowLeft } from 'lucide-react';

const BASE_URL = 'https://www.onyxstudios.ai';

// Render per-request so a post 404s until its publish date (Asia/Taipei) and
// goes live exactly on it — no stale CDN cache serving it early or late.
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  const title = pick(post.title, locale);
  const description = pick(post.dek, locale);
  const url = locale === 'en' ? `/blog/${slug}` : `/${locale}/blog/${slug}`;
  return {
    title: `${title} | Onyx Studios`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      siteName: 'Onyx Studios',
      title,
      description,
      url: `${BASE_URL}${url}`,
      images: [{ url: post.cover, width: 1600, height: 900 }],
      publishedTime: post.date,
      tags: post.tags,
    },
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description,
      images: [post.cover],
    },
  };
}

// Render a paragraph string, turning **bold** spans into <strong>.
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold text-white">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);
  const title = pick(post.title, locale);
  const dek = pick(post.dek, locale);
  const url = locale === 'en' ? `/blog/${slug}` : `/${locale}/blog/${slug}`;

  const fmtDate = (iso: string) =>
    new Date(iso + 'T00:00:00Z').toLocaleDateString(
      isZhCN ? 'zh-CN' : isZh ? 'zh-TW' : 'en-US',
      { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }
    );

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: pick(post.title, 'en'),
    description: pick(post.dek, 'en'),
    image: `${BASE_URL}${post.cover}`,
    datePublished: post.date,
    dateModified: post.date,
    inLanguage: locale,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${BASE_URL}${url}` },
    author: { '@type': 'Organization', name: 'Onyx Studios', url: BASE_URL },
    publisher: {
      '@type': 'Organization',
      name: 'Onyx Studios',
      logo: { '@type': 'ImageObject', url: `${BASE_URL}/logo-og.png` },
    },
    keywords: post.tags.join(', '),
  };

  // First paragraph gets a larger "lead" treatment.
  let leadUsed = false;

  return (
    <>
      <script
        type="application/ld+json"
        // 安全審計 M-3 同類修補:跳脫 `<` 防 `</script>` 注入
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema).replace(/</g, '\\u003c') }}
      />

      <main className="min-h-screen bg-black text-white">
        {/* Header — narrow, editorial */}
        <header className="px-5 pt-28 md:pt-36 pb-10">
          <div className="max-w-[720px] mx-auto">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-10"
            >
              <ArrowLeft className="w-4 h-4" />
              {tx('回部落格', '回博客', 'Back to blog')}
            </Link>

            <div className="flex items-center gap-3 text-xs font-medium tracking-wide text-purple-300/90 uppercase mb-5">
              <span>{post.tags[0]}</span>
              <span className="w-1 h-1 rounded-full bg-gray-600" />
              <span className="text-gray-500 normal-case tracking-normal">
                {fmtDate(post.date)} · {post.readMins} {tx('分鐘閱讀', '分钟阅读', 'min read')}
              </span>
            </div>

            <h1 className="text-[2.1rem] leading-[1.12] md:text-[3.25rem] md:leading-[1.08] font-bold tracking-tight">
              {title}
            </h1>
            <p className="mt-6 text-lg md:text-2xl text-gray-400 leading-relaxed font-light">
              {dek}
            </p>
          </div>
        </header>

        {/* Wide hero */}
        <div className="px-5 mb-14 md:mb-20">
          <div className="max-w-[940px] mx-auto rounded-2xl overflow-hidden border border-white/10 aspect-video bg-white/[0.02]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.cover} alt={title} className="w-full h-full object-cover" />
          </div>
        </div>

        {/* Body — narrow readable measure */}
        <article className="px-5">
          <div className="max-w-[680px] mx-auto">
            {post.body.map((block, i) => {
              if (block.t === 'h2') {
                return (
                  <h2
                    key={i}
                    className="text-2xl md:text-3xl font-bold text-white mt-14 mb-4 tracking-tight"
                  >
                    {pick(block.text, locale)}
                  </h2>
                );
              }
              const isLead = !leadUsed;
              leadUsed = true;
              return (
                <p
                  key={i}
                  className={
                    isLead
                      ? 'text-xl md:text-[1.4rem] leading-[1.7] text-gray-200 font-light mb-8'
                      : 'text-[17px] md:text-[1.18rem] leading-[1.85] text-gray-300/95 mb-7'
                  }
                >
                  {renderInline(pick(block.text, locale))}
                </p>
              );
            })}

            {/* Sources */}
            {post.sources && post.sources.length > 0 && (
              <div className="mt-14 pt-8 border-t border-white/10">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">
                  {tx('資料來源', '资料来源', 'Sources')}
                </h2>
                <ol className="space-y-2.5">
                  {post.sources.map((s, i) => (
                    <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                      <span className="text-gray-600 tabular-nums shrink-0">{i + 1}.</span>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-purple-300 underline underline-offset-2 decoration-white/20 transition-colors break-words"
                      >
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mt-10">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs text-gray-400 bg-white/[0.04] border border-white/10 rounded-full px-3 py-1.5"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </article>

        {/* CTA */}
        <section className="py-20 md:py-28 px-5 mt-12 border-t border-white/5 text-center">
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white tracking-tight">
              {tx('聽聽我們的 AI 聲音', '听听我们的 AI 声音', 'Hear our AI voices')}
            </h2>
            <p className="text-gray-400 mb-8 text-[15px] md:text-base leading-relaxed">
              {tx(
                '錄音室級 AI 配音、客製 TTS、配音與音樂 —— 國語、粵語與 40+ 語言,每筆交付由母語人士把關。',
                '录音室级 AI 配音、定制 TTS、配音与音乐 —— 普通话、粤语与 40+ 语言,每笔交付由母语人士把关。',
                'Studio-grade AI voices, custom TTS, dubbing & music — Mandarin, Cantonese & 40+ languages, every delivery verified by a native speaker.'
              )}
            </p>
            <Link
              href="/voices"
              className="inline-flex items-center gap-2 bg-white text-black px-8 py-3.5 rounded-full font-semibold text-sm hover:bg-gray-100 transition-colors"
            >
              {tx('瀏覽聲音', '浏览声音', 'Browse voices')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        <Footer />
      </main>
    </>
  );
}
