'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { Play, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type PageState = 'loading' | 'success' | 'invalid';

export default function ConfirmPage() {
  const t = useTranslations('authConfirm');
  const ta = useTranslations('auth');
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>('loading');

  useEffect(() => {
    const handleConfirm = async () => {
      const hash = window.location.hash;

      if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');

        if (type === 'signup' && accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            setPageState('invalid');
          } else {
            setPageState('success');
            setTimeout(() => router.push('/dashboard'), 2500);
          }
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setPageState('success');
        setTimeout(() => router.push('/dashboard'), 2500);
        return;
      }

      setPageState('invalid');
    };

    handleConfirm();
  }, [router]);

  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <Play className="w-8 h-8 text-blue-400 group-hover:text-blue-300 transition-colors" />
            <span className="text-2xl font-bold text-white tracking-tight">
              {ta('brandName')}
            </span>
          </Link>
        </div>

        <Card className="bg-[#0a0a0a] border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-2xl text-center">
              {pageState === 'loading'
                ? t('titleLoading')
                : pageState === 'success'
                ? t('titleSuccess')
                : t('titleInvalid')}
            </CardTitle>
          </CardHeader>

          <CardContent>
            {pageState === 'loading' && (
              <div className="py-10 flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                <p className="text-gray-500 text-sm">{t('loadingMessage')}</p>
              </div>
            )}

            {pageState === 'success' && (
              <div className="py-6 text-center space-y-5">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-green-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-lg mb-2">{t('successWelcome')}</p>
                  <p className="text-gray-400 text-sm">
                    {t('successMessage')}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-gray-600 text-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {t('redirecting')}
                </div>
              </div>
            )}

            {pageState === 'invalid' && (
              <div className="py-6 text-center space-y-5">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <AlertCircle className="w-7 h-7 text-red-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-lg mb-2">{t('linkExpired')}</p>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {t('linkExpiredMessage')}
                  </p>
                </div>
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 text-left space-y-3">
                  <p className="text-gray-300 text-sm font-medium">{t('howToAccess')}</p>
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                    <p className="text-gray-400 text-sm">{t.rich('step1', { signIn: (c) => <strong className="text-white">{c}</strong>, forgotPw: (c) => <strong className="text-white">{c}</strong> })}</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                    <p className="text-gray-400 text-sm">{t('step2')}</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                    <p className="text-gray-400 text-sm">{t('step3')}</p>
                  </div>
                </div>
                <Link
                  href="/auth"
                  className="inline-flex items-center justify-center w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm"
                >
                  {t('goToSignIn')}
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
