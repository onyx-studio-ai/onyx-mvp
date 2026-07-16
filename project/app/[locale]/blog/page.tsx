import { Link } from '@/i18n/navigation';
import Footer from '@/components/landing/Footer';
import { getAllPosts, pick } from '@/lib/blog/posts';
import { ArrowRight } from 'lucide-react';

// Render per-request so scheduled (future-dated) posts appear exactly on their
// publish date (Asia/Taipei), with no stale CDN cache serving the wrong set.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);
  const title = tx(
    'AI 配音、音樂與在地化的觀點 | Onyx Studios 部落格',
    'AI 配音、音乐与本地化的观点 | Onyx Studios 博客',
    'AI Voice, Music & Localization — Onyx Studios Blog'
  );
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
          <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight leading-[1.02]">
            {tx('Onyx 誌', 'Onyx 志', 'The Onyx Journal')}
          </h1>
          <p className="text-lg text-gray-400 leading-relaxed">
            {tx(
              'AI 配音、音樂、影片與在地化的觀點——只談有數據撐腰的事。AI 生成,真人把關。',
              'AI 配音、音乐、视频与本地化的观点——只谈有数据撑腰的事。AI 生成,真人把关。',
              'Perspectives on AI voice, music, video and localization — every claim backed by data. AI-Generated. Human-Perfected.'
            )}
          </p>
        </div>
      </section>

      {/* Post list — compact rows: small square thumbnail left, text right */}
      <section className="pb-24 px-4">
        <div className="max-w-6xl mx-auto flex flex-col gap-2">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex items-center gap-4 sm:gap-5 rounded-xl border border-transparent p-2.5 sm:p-3 hover:border-white/10 hover:bg-white/[0.03] transition-colors"
            >
              <div className="shrink-0 w-28 sm:w-44 lg:w-60 aspect-video rounded-lg bg-black/40 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.cover}
                  alt={pick(post.title, locale)}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-500 mb-1.5">
                  {fmtDate(post.date)} · {post.readMins} {tx('分鐘閱讀', '分钟阅读', 'min read')}
                </div>
                <h2 className="text-base sm:text-lg font-bold leading-snug mb-1 line-clamp-2 group-hover:text-white">
                  {pick(post.title, locale)}
                </h2>
                <p className="text-gray-400 text-[13px] sm:text-[14px] leading-relaxed line-clamp-2">
                  {pick(post.dek, locale)}
                </p>
              </div>
              <ArrowRight className="hidden sm:block shrink-0 w-5 h-5 text-gray-600 transition-all group-hover:text-purple-300 group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
