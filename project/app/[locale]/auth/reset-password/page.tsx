'use client';

import { useState, useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Play, Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';

type PageState = 'loading' | 'ready' | 'success' | 'invalid';

export default function ResetPasswordPage() {
  const t = useTranslations('authResetPassword');
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleRecovery = async () => {
      const hash = window.location.hash;

      if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');

        if (type === 'recovery' && accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            setPageState('invalid');
          } else {
            setPageState('ready');
          }
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setPageState('ready');
        return;
      }

      supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setPageState('ready');
        }
      });

      setTimeout(() => {
        setPageState((current) => (current === 'loading' ? 'invalid' : current));
      }, 3000);
    };

    handleRecovery();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError(t('errorMinLength'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('errorMismatch'));
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPageState('success');
      setTimeout(() => router.push('/dashboard'), 2500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update password. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const strength = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (password.length >= 12) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const strengthLabel = ['', t('strengthWeak'), t('strengthFair'), t('strengthGood'), t('strengthStrong'), t('strengthVeryStrong')][strength];
  const strengthColor = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400', 'bg-green-500'][strength];

  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <Play className="w-8 h-8 text-blue-400 group-hover:text-blue-300 transition-colors" />
            <span className="text-2xl font-bold text-white tracking-tight">
              Onyx Studios Platform
            </span>
          </Link>
        </div>

        <Card className="bg-[#0a0a0a] border-white/10">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-2xl text-center">
              {pageState === 'success' ? t('titleSuccess') : t('titleReady')}
            </CardTitle>
            <p className="text-gray-400 text-sm text-center mt-1">
              {pageState === 'success'
                ? 'Redirecting you to your dashboard...'
                : pageState === 'invalid'
                ? 'This link is invalid or has expired.'
                : pageState === 'loading'
                ? 'Verifying your link...'
                : 'Choose a strong password for your account.'}
            </p>
          </CardHeader>

          <CardContent>
            {pageState === 'loading' && (
              <div className="py-10 flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                <p className="text-gray-500 text-sm">Verifying your link...</p>
              </div>
            )}

            {pageState === 'invalid' && (
              <div className="py-6 text-center space-y-5">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <AlertCircle className="w-7 h-7 text-red-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    This password reset link is invalid or has expired.<br />
                    Please request a new one.
                  </p>
                </div>
                <Link
                  href="/auth"
                  className="inline-block text-blue-400 hover:text-blue-300 text-sm transition-colors"
                >
                  Back to Sign In
                </Link>
              </div>
            )}

            {pageState === 'success' && (
              <div className="py-6 text-center space-y-5">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-green-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-lg mb-2">{t('titleSuccess')}</p>
                  <p className="text-gray-400 text-sm">
                    {t('successMessage')}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-gray-600 text-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Taking you to your dashboard...
                </div>
              </div>
            )}

            {pageState === 'ready' && (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-gray-300 text-sm">
                    {t('labelNewPassword')}
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="bg-[#050505] border-white/10 text-white placeholder:text-gray-600 h-11 pr-11 focus:border-blue-500/50 focus:ring-blue-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password && (
                    <div className="space-y-1.5">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${i <= strength ? strengthColor : 'bg-white/10'}`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-gray-500">
                        Strength: <span className="text-gray-300">{strengthLabel}</span>
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-gray-300 text-sm">
                    {t('labelConfirmPassword')}
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      className="bg-[#050505] border-white/10 text-white placeholder:text-gray-600 h-11 pr-11 focus:border-blue-500/50 focus:ring-blue-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-400">{t('passwordsDoNotMatch')}</p>
                  )}
                  {confirmPassword && password === confirmPassword && password.length >= 8 && (
                    <p className="text-xs text-green-400">{t('passwordsMatch')}</p>
                  )}
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading || !password || !confirmPassword}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('buttonUpdatePassword')}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
