import { useTranslations } from 'next-intl';
import Footer from '@/components/landing/Footer';
const ECOSYSTEM_KEYS = ['ecosystemItem1', 'ecosystemItem2', 'ecosystemItem3'] as const;


export default function AboutPage() {
  const t = useTranslations('about');
  return (
    <main className="min-h-screen bg-[#050505] text-white overflow-x-hidden pt-20">
      <div className="relative py-20 px-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.05),transparent_50%)]" />

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              {t('heroTitlePart1')}{' '}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                {t('heroTitleHighlight')}
              </span>
            </h1>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              {t('heroSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20 max-w-5xl mx-auto">
            <div className="text-center p-8 rounded-2xl bg-gradient-to-b from-blue-950/30 to-transparent border border-blue-500/20">
              <div className="text-5xl font-bold text-blue-400 mb-2">17+</div>
              <div className="text-gray-300 font-medium">{t('statYearsExperience')}</div>
            </div>
            <div className="text-center p-8 rounded-2xl bg-gradient-to-b from-cyan-950/30 to-transparent border border-cyan-500/20">
              <div className="text-5xl font-bold text-cyan-400 mb-2">7,900+</div>
              <div className="text-gray-300 font-medium">{t('statProjectsDelivered')}</div>
            </div>
            <div className="text-center p-8 rounded-2xl bg-gradient-to-b from-emerald-950/30 to-transparent border border-emerald-500/20">
              <div className="text-5xl font-bold text-emerald-400 mb-2">100%</div>
              <div className="text-gray-300 font-medium">{t('statBroadcastQuality')}</div>
            </div>
          </div>

          <div className="max-w-4xl mx-auto mb-24">
            <div className="p-12 rounded-3xl bg-gradient-to-b from-[#0a0a0a] to-[#0f0f0f] border border-white/10">
              <h2 className="text-3xl font-bold mb-6">{t('ourStory')}</h2>
              <div className="space-y-4 text-gray-300 leading-relaxed">
                <p>{t('storyParagraph1')}</p>
                <p>{t('storyParagraph2')}</p>
                <p>{t('storyParagraph3')}</p>
                <p className="text-blue-400 font-medium pt-4">
                  {t('storyTagline')}
                </p>
              </div>
            </div>
          </div>

          <div className="mb-24">
            <h2 className="text-4xl font-bold mb-12 text-center">
              {t('ecosystemTitle')}
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {ECOSYSTEM_KEYS.map((key, index) => (
                <div
                  key={index}
                  className="p-8 rounded-2xl bg-gradient-to-b from-[#0a0a0a] to-[#0f0f0f] border border-white/10 hover:border-white/20 transition-all"
                >
                  <h3 className="text-xl font-bold mb-3 text-blue-400">{t(`${key}Title`)}</h3>
                  <p className="text-gray-400 leading-relaxed text-sm">{t(`${key}Desc`)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center p-12 rounded-3xl bg-gradient-to-br from-blue-950/30 to-cyan-950/30 border border-blue-500/20">
            <h2 className="text-3xl font-bold mb-4">{t('ctaTitle')}</h2>
            <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
              {t('ctaSubtitle')}
            </p>
            <a
              href="/contact"
              className="inline-block px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              {t('ctaButton')}
            </a>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
