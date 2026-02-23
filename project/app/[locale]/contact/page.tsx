import { useTranslations } from 'next-intl';
import Footer from '@/components/landing/Footer';
import { Mail, MapPin, Building2, Globe, Headphones, CreditCard, Shield, Sparkles } from 'lucide-react';

const DEPARTMENTS = [
  { labelKey: 'deptGeneralLabel', email: 'hello@onyxstudios.ai', descKey: 'deptGeneralDesc', icon: Sparkles, accent: 'emerald' },
  { labelKey: 'deptSupportLabel', email: 'support@onyxstudios.ai', descKey: 'deptSupportDesc', icon: Headphones, accent: 'blue' },
  { labelKey: 'deptProductionLabel', email: 'produce@onyxstudios.ai', descKey: 'deptProductionDesc', icon: Mail, accent: 'amber' },
  { labelKey: 'deptBillingLabel', email: 'billing@onyxstudios.ai', descKey: 'deptBillingDesc', icon: CreditCard, accent: 'purple' },
  { labelKey: 'deptAdminLabel', email: 'admin@onyxstudios.ai', descKey: 'deptAdminDesc', icon: Shield, accent: 'rose' },
];

const ACCENT_STYLES: Record<string, { bg: string; border: string; icon: string; text: string }> = {
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20 hover:border-emerald-500/40', icon: 'text-emerald-400', text: 'text-emerald-400' },
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20 hover:border-blue-500/40', icon: 'text-blue-400', text: 'text-blue-400' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20 hover:border-amber-500/40', icon: 'text-amber-400', text: 'text-amber-400' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20 hover:border-purple-500/40', icon: 'text-purple-400', text: 'text-purple-400' },
  rose: { bg: 'bg-rose-500/10', border: 'border-rose-500/20 hover:border-rose-500/40', icon: 'text-rose-400', text: 'text-rose-400' },
};

export default function ContactPage() {
  const t = useTranslations('contactPage');
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
                  const Icon = dept.icon;
                  return (
                    <a
                      key={dept.email}
                      href={`mailto:${dept.email}`}
                      className={`group flex items-start gap-4 px-5 py-4 rounded-xl bg-white/[0.03] border ${style.border} transition-all duration-200`}
                    >
                      <div className={`w-10 h-10 rounded-lg ${style.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <Icon className={`w-5 h-5 ${style.icon}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-semibold text-white">{t(dept.labelKey)}</p>
                          <Mail className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors flex-shrink-0" />
                        </div>
                        <p className={`text-sm font-mono ${style.text} mb-1`}>{dept.email}</p>
                        <p className="text-xs text-gray-500 leading-relaxed">{t(dept.descKey)}</p>
                      </div>
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

                <div className="relative p-6 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <Globe className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-1">{t('londonTitle')}</h3>
                      <p className="text-sm text-gray-500 mb-3">{t('londonRole')}</p>
                      <p className="text-gray-400 text-sm leading-relaxed mb-3">
                        {t('remoteHub')}
                      </p>
                      
                      <div className="flex items-center gap-1.5 mt-3 px-2 py-1 bg-emerald-500/10 rounded-full w-fit">
                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                        <span className="text-emerald-400 text-xs font-medium">{t('londonStatus')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-20 text-center p-12 rounded-3xl bg-gradient-to-br from-blue-950/30 to-cyan-950/30 border border-blue-500/20 max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-4">{t('ctaTitle')}</h2>
            <p className="text-gray-300 mb-8 text-lg">
              {t('ctaDesc')}
            </p>
            <a
              href="/pricing"
              className="inline-block px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors text-lg"
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
