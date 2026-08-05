import { Link } from '@/i18n/navigation';
import Footer from '@/components/landing/Footer';
import { ArrowRight } from 'lucide-react';
import { getClientFaqs } from '@/lib/faq-data';

export default async function FAQPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  const faqs = getClientFaqs(tx);

  // Flatten for FAQPage schema — use English answers for max LLM discoverability
  const schemaFaqs = faqs.flatMap(cat =>
    cat.items.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    }))
  );

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: schemaFaqs,
  };

  return (
    <>
      {/* FAQPage structured data for Google rich results + LLM citation */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <main className="min-h-screen bg-black text-white">
        {/* Hero */}
        <section className="pt-28 pb-16 px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-purple-300/25 bg-purple-500/[0.08] px-5 py-2">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              <span className="text-sm tracking-wide text-gray-100 font-medium">
                {tx('常見問題', '常见问题', 'FAQ')}
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight leading-tight">
              {tx('常見問題', '常见问题', 'Frequently Asked\nQuestions')}
            </h1>
            <p className="text-lg text-gray-400 leading-relaxed">
              {tx(
                '關於 AI 配音、多語配音、音樂製作與語音數據服務的常見問題。',
                '关于 AI 配音、多语配音、音乐制作与语音数据服务的常见问题。',
                'Everything you need to know about our AI voiceover, dubbing, music production, and speech data services.'
              )}
            </p>
          </div>
        </section>

        {/* FAQ content */}
        <section className="pb-24 px-4">
          <div className="max-w-3xl mx-auto space-y-16">
            {faqs.map((cat, ci) => (
              <div key={ci}>
                {/* Category heading */}
                <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-purple-400 mb-8 pb-3 border-b border-white/10">
                  {cat.category}
                </h2>

                {/* Q&A items */}
                <div className="space-y-10">
                  {cat.items.map((item, qi) => (
                    <div key={qi}>
                      <h3 className="text-lg md:text-xl font-semibold text-white mb-3 leading-snug">
                        {item.q}
                      </h3>
                      <p className="text-gray-400 leading-relaxed text-[15px] md:text-base">
                        {item.a}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-4 border-t border-white/5 text-center">
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white">
              {tx('還有其他問題？', '还有其他问题？', 'Still have questions?')}
            </h2>
            <p className="text-gray-400 mb-8 text-[15px] leading-relaxed">
              {tx(
                '我們的團隊隨時準備為您解答，也歡迎直接送出專案需求。',
                '我们的团队随时准备为您解答，也欢迎直接提交项目需求。',
                'Our team is ready to help. You can also submit a project brief directly and we\'ll get back to you within one business day.'
              )}
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-white text-black px-8 py-3.5 rounded-full font-semibold text-sm hover:bg-gray-100 transition-colors"
            >
              {tx('聯繫我們', '联系我们', 'Contact Us')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        <Footer />
      </main>
    </>
  );
}
