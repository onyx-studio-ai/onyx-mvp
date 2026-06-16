import { Link } from '@/i18n/navigation';
import Footer from '@/components/landing/Footer';
import { getAllPosts, pick } from '@/lib/blog/posts';
import { ArrowRight } from 'lucide-react';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);
  const title = tx('部落格 | Onyx Studios', '博客 | Onyx Studios', 'Blog | Onyx Studios');
  const description = tx(
    'AI 配音、多語在地化與語音品質的觀點與研究。AI 生成,真人把關。',
    'AI 配音、多语本地化与语音质量的观点与研究。AI 生成,真人把关。',
    'Perspectives and research on AI voice, multilingual localization, and audio quality. AI-Generated. Human-Perfected.'
  );
  return {
    title,
    description,
    alternates: { canonical: '/blog' },
    openGraph: { type: 'website', siteName: 'Onyx Studios', title, description },
    twitter: { card: 'summary_large_image' as const, title, description },
  };
}

export default async function BlogIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);
  const posts = getAllPosts();

  const fmtDate = (iso: string) =>
    new Date(iso + 'T00:00:00Z').toLocaleDateString(
      isZhCN ? 'zh-CN' : isZh ? 'zh-TW' : 'en-US',
      { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }
    );

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Hero */}
      <section className="pt-28 pb-14 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-purple-300/25 bg-purple-500/[0.08] px-5 py-2">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span className="text-sm tracking-wide text-gray-100 font-medium">
              {tx('部落格', '博客', 'Blog')}
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight leading-tight">
            {tx('觀點與研究', '观点与研究', 'Perspectives & Research')}
          </h1>
          <p className="text-lg text-gray-400 leading-relaxed">
            {tx(
              'AI 配音、多語在地化與語音品質的深度觀點。AI 生成,真人把關。',
              'AI 配音、多语本地化与语音质量的深度观点。AI 生成,真人把关。',
              'In-depth takes on AI voice, multilingual localization, and audio quality. AI-Generated. Human-Perfected.'
            )}
          </p>
        </div>
      </section>

      {/* Post list */}
      <section className="pb-24 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group block rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden hover:border-white/20 hover:bg-white/[0.04] transition-colors"
            >
              <div className="md:flex">
                <div className="md:w-2/5 aspect-[16/10] md:aspect-auto bg-black/40 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.cover}
                    alt={pick(post.title, locale)}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-6 md:p-8 md:w-3/5 flex flex-col">
                  <div className="text-xs text-gray-500 mb-3">
                    {fmtDate(post.date)} · {post.readMins} {tx('分鐘閱讀', '分钟阅读', 'min read')}
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold leading-snug mb-3 group-hover:text-white">
                    {pick(post.title, locale)}
                  </h2>
                  <p className="text-gray-400 text-[15px] leading-relaxed line-clamp-3">
                    {pick(post.dek, locale)}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-purple-300">
                    {tx('閱讀全文', '阅读全文', 'Read article')}
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
