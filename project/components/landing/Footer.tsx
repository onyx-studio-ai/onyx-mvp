'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function Footer() {
  const t = useTranslations('footer');

  return (
    <footer className="relative py-16 px-4 border-t border-white/5">
      <div className="absolute inset-0 bg-[#050505]" />

      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="text-center space-y-8">
          <div className="flex items-center justify-center">
            <Link href="/">
              <img
                src="/logo-onyx.png"
                alt="Onyx Studios"
                className="h-10 w-auto opacity-90 hover:opacity-100 transition-opacity"
              />
            </Link>
          </div>

          <p className="text-gray-500 text-sm italic">
            {t('tagline')}
          </p>

          <div className="py-6 border-t border-b border-white/5 space-y-4">
            <div className="text-gray-400 text-sm">
              <p>{t('locations')}</p>
            </div>

            <div className="flex items-center justify-center gap-6 text-xs text-gray-600 flex-wrap">
              <Link href="/about" className="hover:text-gray-400 transition-colors">
                {t('aboutUs')}
              </Link>
              <span>•</span>
              <Link href="/contact" className="hover:text-gray-400 transition-colors">
                {t('contact')}
              </Link>
              <span>•</span>
              <Link href="/legal/terms" className="hover:text-gray-400 transition-colors">
                {t('termsOfService')}
              </Link>
              <span>•</span>
              <Link href="/legal/privacy" className="hover:text-gray-400 transition-colors">
                {t('privacyPolicy')}
              </Link>
              <span>•</span>
              <Link href="/legal/aup" className="hover:text-gray-400 transition-colors">
                {t('acceptableUsePolicy')}
              </Link>
              <span>•</span>
              <Link href="/apply" className="hover:text-gray-400 transition-colors">
                {t('joinTalentRoster')}
              </Link>
            </div>

            <div className="text-gray-500 text-xs">
              <p>{t('supportEmail')}</p>
            </div>

            <div className="pt-4">
              <p className="text-gray-500 text-xs leading-relaxed max-w-3xl mx-auto">
                <strong>{t('refundPolicyLabel')}</strong> {t('refundPolicyText')}
              </p>
            </div>
          </div>

          <div className="pt-6 space-y-3 text-gray-500 text-xs">
            <p className="font-semibold text-sm">{t('globalOperations')}</p>
            <div className="space-y-1">
              <p><strong>{t('billingLabel')}</strong> {t('billingEntity')}</p>
              <p><strong>{t('taxIdLabel')}</strong> {t('taxIdValue')}</p>
              <p><strong>{t('addressLabel')}</strong> {t('addressValue')}</p>
              <p>{t('contactInfo')}</p>
            </div>
          </div>

          <div className="pt-6 text-gray-600 text-xs">
            <p>{t('copyright')}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
