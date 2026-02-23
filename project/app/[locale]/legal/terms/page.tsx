import { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { DisclaimerBanner, PageTitle, SH, LastUpdated } from '../_components/legal-i18n';
import '../legal-content.css';

export const metadata: Metadata = {
  title: 'Terms of Service | Onyx Studios',
  description: 'Terms of Service governing the use of Onyx Studios AI Voice Synthesis and Global Music Production Services.',
};

export default async function TermsPage() {
  const locale = await getLocale();
  const t = await getTranslations('legal.terms');

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-3xl mx-auto pt-32 pb-16 px-6">
        <div className="mb-10 pb-6 border-b border-white/10">
          <p className="text-[11px] text-gray-500 tracking-widest uppercase mb-3">
            Onyx Studios
          </p>
          <PageTitle page="terms" locale={locale}>{t('title')}</PageTitle>
          <LastUpdated locale={locale} date={t('lastUpdated')} />
        </div>

        <DisclaimerBanner locale={locale} />

        <article className="space-y-8 text-[13px] leading-relaxed text-gray-400">
          {Array.from({ length: 58 }, (_, i) => i + 1).map(n => (
            <section key={n}>
              <SH id={`terms.${n}`} locale={locale}>{t(`s${n}Title`)}</SH>
              <div
                className="legal-content space-y-3"
                dangerouslySetInnerHTML={{ __html: t.raw(`s${n}Body`) }}
              />
            </section>
          ))}

          <div className="text-center pt-6 pb-4 border-t border-white/5">
            <p className="text-gray-600 text-[11px]">{t('footer')}</p>
          </div>
        </article>
      </div>
    </main>
  );
}
