'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';

export default function Footer() {
  const t = useTranslations('footer');

  return (
    <footer className="relative py-16 px-4 border-t border-white/5">
      <div className="absolute inset-0 bg-[#050505]" />

      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="text-center space-y-8">
          <div className="flex items-center justify-center">
            <Link href="/">
              <Image
                src="/logo-horizontal-white.svg"
                alt="Onyx Studios"
                width={160}
                height={40}
                className="h-10 w-auto opacity-90 hover:opacity-100 transition-opacity"
              />
            </Link>
          </div>

          <p className="text-gray-500 text-sm italic">
            {t('tagline')}
          </p>

          <div className="py-6 border-t border-b border-white/5 space-y-4">
            {/* Services nav — internal links for SEO */}
            <div className="flex items-center justify-center gap-6 text-xs text-gray-500 flex-wrap">
              <Link href="/voice" className="hover:text-gray-300 transition-colors">
                {t('voiceStudio')}
              </Link>
              <span>·</span>
              <Link href="/music" className="hover:text-gray-300 transition-colors">
                {t('musicStudio')}
              </Link>
              <span>·</span>
              <Link href="/dubbing" className="hover:text-gray-300 transition-colors">
                {t('dubbingStudio')}
              </Link>
              <span>·</span>
              <Link href="/data" className="hover:text-gray-300 transition-colors">
                {t('dataStudio')}
              </Link>
              <span>·</span>
              <Link href="/voices" className="hover:text-gray-300 transition-colors">
                {t('voiceRoster')}
              </Link>
              <span>·</span>
              <Link href="/faq" className="hover:text-gray-300 transition-colors">
                {t('faq')}
              </Link>
              <span>·</span>
              <Link href="/tools" className="hover:text-gray-300 transition-colors">
                {t('aiTools')}
              </Link>
              <span>·</span>
              <Link href="/blog" className="hover:text-gray-300 transition-colors">
                {t('blog')}
              </Link>
            </div>

            <div className="flex items-center justify-center gap-6 text-xs text-gray-600 flex-wrap">
              <Link href="/about" className="hover:text-gray-400 transition-colors">
                {t('aboutUs')}
              </Link>
              <span>•</span>
              <Link href="/pricing" className="hover:text-gray-400 transition-colors">
                {t('pricing')}
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
                <strong>
                  <Link href="/legal/refund" className="hover:text-gray-400 transition-colors">
                    {t('refundPolicyLabel')}
                  </Link>
                </strong>{' '}
                {t('refundPolicyText')}
              </p>
            </div>
          </div>

          <div className="pt-6 space-y-3 text-gray-500 text-xs">
            <p className="font-semibold text-sm">{t('globalOperations')}</p>
            <div className="space-y-1">
              <p><strong>{t('billingLabel')}</strong> {t('billingEntity')}</p>
              <p><strong>{t('taxIdLabel')}</strong> {t('taxIdValue')}</p>
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
