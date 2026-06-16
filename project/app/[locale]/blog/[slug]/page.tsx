import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import Footer from '@/components/landing/Footer';
import { getAllPosts, getPost, pick } from '@/lib/blog/posts';
import { ArrowRight, ArrowLeft } from 'lucide-react';

const BASE_URL = 'https://www.onyxstudios.ai';

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

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
      images: [{ url: post.cover }],
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
      <strong key={i} className="text-white font-semibold">
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <main className="min-h-screen bg-black text-white">
        <article className="pt-28 pb-16 px-4">
          <div className="max-w-2xl mx-auto">
            {/* Back */}
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-8"
            >
              <ArrowLeft className="w-4 h-4" />
              {tx('回部落格', '回博客', 'Back to blog')}
            </Link>

            {/* Header */}
            <div className="text-xs text-gray-500 mb-4">
              {fmtDate(post.date)} · {post.readMins} {tx('分鐘閱讀', '分钟阅读', 'min read')}
            </div>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight tracking-tight mb-5">
              {title}
            </h1>
            <p className="text-lg md:text-xl text-gray-400 leading-relaxed mb-8">{dek}</p>

            {/* Cover */}
            <div className="rounded-2xl overflow-hidden border border-white/10 mb-12">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.cover} alt={title} className="w-full" />
            </div>

            {/* Body */}
            <div className="space-y-6">
              {post.body.map((block, i) =>
                block.t === 'h2' ? (
                  <h2 key={i} className="text-2xl font-bold text-white pt-4">
                    {pick(block.text, locale)}
                  </h2>
                ) : (
                  <p
                    key={i}
                    className="text-gray-300 leading-[1.85] text-[17px] md:text-lg"
                  >
                    {renderInline(pick(block.text, locale))}
                  </p>
                )
              )}
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mt-12 pt-8 border-t border-white/10">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs text-gray-400 bg-white/[0.04] border border-white/10 rounded-full px-3 py-1"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </article>

        {/* CTA */}
        <section className="py-20 px-4 border-t border-white/5 text-center">
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white">
              {tx('聽聽我們的 AI 聲音', '听听我们的 AI 声音', 'Hear our AI voices')}
            </h2>
            <p className="text-gray-400 mb-8 text-[15px] leading-relaxed">
              {tx(
                '錄音室級 AI 配音、客製 TTS、配音與音樂 —— 國語、粵語與 40+ 語言,每筆交付由母語真人把關。',
                '录音室级 AI 配音、定制 TTS、配音与音乐 —— 普通话、粤语与 40+ 语言,每笔交付由母语真人把关。',
                'Studio-grade AI voices, custom TTS, dubbing & music — Mandarin, Cantonese & 40+ languages, every delivery verified by a native human.'
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
