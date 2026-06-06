import { useTranslations } from 'next-intl';
import { use } from 'react';
import Footer from '@/components/landing/Footer';
import ContactInquiryForm from '@/components/ContactInquiryForm';
import { Mail, Building2, Globe, Calendar } from 'lucide-react';

type SupportedLocale = 'en' | 'zh-TW' | 'zh-CN';

const DEPARTMENTS = [
  { labelKey: 'deptGeneralLabel', email: 'hello@onyxstudios.ai', descKey: 'deptGeneralDesc', accent: 'emerald' },
  { labelKey: 'deptSupportLabel', email: 'support@onyxstudios.ai', descKey: 'deptSupportDesc', accent: 'blue' },
  { labelKey: 'deptProductionLabel', email: 'produce@onyxstudios.ai', descKey: 'deptProductionDesc', accent: 'amber' },
  { labelKey: 'deptBillingLabel', email: 'billing@onyxstudios.ai', descKey: 'deptBillingDesc', accent: 'purple' },
  { labelKey: 'deptAdminLabel', email: 'admin@onyxstudios.ai', descKey: 'deptAdminDesc', accent: 'rose' },
];

const ACCENT_STYLES: Record<string, { border: string; text: string }> = {
  emerald: { border: 'border-emerald-500/20 hover:border-emerald-500/40', text: 'text-emerald-400' },
  blue:    { border: 'border-blue-500/20 hover:border-blue-500/40',       text: 'text-blue-400' },
  amber:   { border: 'border-amber-500/20 hover:border-amber-500/40',     text: 'text-amber-400' },
  purple:  { border: 'border-purple-500/20 hover:border-purple-500/40',   text: 'text-purple-400' },
  rose:    { border: 'border-rose-500/20 hover:border-rose-500/40',       text: 'text-rose-400' },
};

export default function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const t = useTranslations('contactPage');
  const { locale: rawLocale } = use(params);
  const locale: SupportedLocale =
    rawLocale === 'zh-TW' || rawLocale === 'zh-CN' ? rawLocale : 'en';
  return (
    <main className="min-h-screen bg-[#050505] text-white overflow-x-hidden pt-20">
      <div className="relative py-20 px-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.05),transparent_50%)]" />

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              {t('pageTitle')}
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              {t('pageSubtitle')}
            </p>
          </div>

          <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 lg:gap-16">
            {/* Email Directory */}
            <div>
              <h2 className="text-3xl font-bold mb-4">{t('getInTouch')}</h2>
              <p className="text-gray-400 mb-8 text-lg leading-relaxed">
                {t('getInTouchDesc')}
              </p>

              <div className="space-y-3">
                {DEPARTMENTS.map((dept) => {
                  const style = ACCENT_STYLES[dept.accent];
                  return (
                    <a
                      key={dept.email}
                      href={`mailto:${dept.email}`}
                      className={`group block px-5 py-4 rounded-xl bg-white/[0.03] border ${style.border} transition-all duration-200`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-semibold text-white">{t(dept.labelKey)}</p>
                        <Mail className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors flex-shrink-0" aria-hidden="true" />
                      </div>
                      <p className={`text-sm font-mono ${style.text} mb-1`}>{dept.email}</p>
                      <p className="text-xs text-gray-500 leading-relaxed">{t(dept.descKey)}</p>
                    </a>
                  );
                })}
              </div>
            </div>

            {/* Office Hubs */}
            <div>
              <h2 className="text-3xl font-bold mb-8">{t('ourHubs')}</h2>
              <p className="text-gray-400 text-sm mb-6">{t('globalCoverage')}</p>

              <div className="space-y-8">
                <div className="relative p-6 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-1">{t('taipeiTitle')}</h3>
                      <p className="text-sm text-gray-500 mb-3">{t('taipeiRole')}</p>
                      <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-line">
                        {t('taipeiAddress')}
                      </p>
                      <p className="text-gray-500 text-xs mt-3">
                        {t('taipeiTel')}
                      </p>
                      <div className="flex items-center gap-1.5 mt-3 px-2 py-1 bg-blue-500/10 rounded-full w-fit">
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                        <span className="text-blue-400 text-xs font-medium">{t('taipeiHours')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* LOCKED — "London Studio" hub card removed pending Wing's
                    confirmation of a real UK presence. The previous card
                    rendered an "Online / Active (GMT)" animated green dot
                    suggesting a live London office; Onyx's actual studio is
                    SONICNEST in Taipei Nangang (see CLAUDE.md). To re-enable,
                    confirm UK entity / address / contact and uncomment. */}
              </div>
            </div>
          </div>

          {/* ──────────────────────────────────────────────
              Book a call (Calendly) — driven by env var.
              Set NEXT_PUBLIC_CALENDLY_URL in .env to activate.
              When unset, this section is hidden completely. */}
          {process.env.NEXT_PUBLIC_CALENDLY_URL ? (
            <div className="max-w-3xl mx-auto mt-16 mb-12">
              <div className="rounded-2xl bg-gradient-to-br from-blue-500/[0.08] to-purple-500/[0.05] border border-blue-500/20 p-8 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/15 mb-4">
                  <Calendar className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold mb-2">
                  {locale === 'zh-TW' ? '預約 30 分鐘討論' : locale === 'zh-CN' ? '预约 30 分钟讨论' : 'Book a 30-minute call'}
                </h3>
                <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto leading-relaxed">
                  {locale === 'zh-TW'
                    ? '案件規格較複雜、或需要走過案例?直接挑時段聊。'
                    : locale === 'zh-CN'
                    ? '案件规格较复杂、或需要走过案例?直接挑时段聊。'
                    : 'Got a complex brief or want to walk through past work? Pick a time below.'}
                </p>
                <a
                  href={process.env.NEXT_PUBLIC_CALENDLY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  {locale === 'zh-TW' ? '挑時段' : locale === 'zh-CN' ? '挑时段' : 'See available times'}
                </a>
              </div>
            </div>
          ) : null}

          <ContactInquiryForm locale={locale} />
        </div>
      </div>
      <Footer />
    </main>
  );
}
