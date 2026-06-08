import { Link } from '@/i18n/navigation';
import Footer from '@/components/landing/Footer';
import ToolsGrid from '@/components/tools/ToolsGrid';

export default async function ToolsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isZhCN = locale === 'zh-CN';
  const isZh   = locale.startsWith('zh');
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  return (
    <div className="min-h-screen bg-[#050505]">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-14 px-4 text-center">
        <div className="max-w-2xl mx-auto space-y-4">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-amber-400">
            {tx('Onyx Studios 策劃', 'Onyx Studios 策划', 'Curated by Onyx Studios')}
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-white">
            {tx('AI 工具推薦', 'AI 工具推荐', 'AI Tools Directory')}
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            {tx(
              '為語音、音樂與音訊工作者精心策劃的工具清單。20 款精選，持續更新，免費收錄。',
              '为语音、音乐与音频工作者精心策划的工具清单。20 款精选，持续更新，免费收录。',
              '20 curated AI tools for voice actors, audio engineers, and music creators. Free to browse, updated regularly.',
            )}
          </p>
        </div>
      </section>

      {/* ── Grid + filter ─────────────────────────────────────────────────── */}
      <section className="px-4 pb-24 max-w-7xl mx-auto">
        <ToolsGrid locale={locale} />
      </section>

      {/* ── Bottom CTA ────────────────────────────────────────────────────── */}
      <section className="border-t border-white/5 py-16 px-4 text-center">
        <div className="max-w-xl mx-auto space-y-2">
          <p className="text-gray-500 text-sm">
            {tx(
              '需要交付等級的 AI 配音或音樂製作？',
              '需要交付等级的 AI 配音或音乐制作？',
              'Need delivery-grade AI voiceover or music production?',
            )}
          </p>
          <p className="text-gray-300 text-base">
            {tx(
              '這些工具做得很棒——但當你需要專業交件時，',
              '这些工具做得很棒——但当你需要专业交件时，',
              'These tools are great for exploration — when you need production-ready output, ',
            )}
            <Link href="/voice" className="text-amber-400 hover:text-amber-300 transition-colors font-medium">
              {tx('Onyx Studios 幫你搞定', 'Onyx Studios 帮你搞定', 'Onyx Studios has you covered')}
            </Link>
            {tx('。', '。', '.')}
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
