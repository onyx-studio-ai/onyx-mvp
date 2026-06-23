import { useTranslations } from 'next-intl';
import { use } from 'react';
import Footer from '@/components/landing/Footer';
import ContactInquiryForm from '@/components/ContactInquiryForm';
import { Mail, Building2, Globe } from 'lucide-react';

type SupportedLocale = 'en' | 'zh-TW' | 'zh-CN';

const DEPARTMENTS = [
  { labelKey: 'deptGeneralLabel', email: 'hello@onyxstudios.ai', descKey: 'deptGeneralDesc', accent: 'blue' },
  { labelKey: 'deptSupportLabel', email: 'support@onyxstudios.ai', descKey: 'deptSupportDesc', accent: 'blue' },
  { labelKey: 'deptProductionLabel', email: 'produce@onyxstudios.ai', descKey: 'deptProductionDesc', accent: 'blue' },
  { labelKey: 'deptBillingLabel', email: 'billing@onyxstudios.ai', descKey: 'deptBillingDesc', accent: 'blue' },
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
                      {/* Street address & phone intentionally not shown — the
                          registered address is mail-only with no walk-in/phone
                          staffing; contact is email-first. Region + hours convey
                          timezone without implying a visitable office. */}
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

          {/* Calendly card removed (2026-06-07) — Wing's preferred
              workflow is email-first qualifying, then send the
              Calendly link from /admin/inquiries reply composer
              when she actually wants to meet. NEXT_PUBLIC_CALENDLY_URL
              env var stays defined in Vercel but only the admin
              "+ Calendly" button uses it now. */}

          <ContactInquiryForm locale={locale} />
        </div>
      </div>
      <Footer />
    </main>
  );
}
