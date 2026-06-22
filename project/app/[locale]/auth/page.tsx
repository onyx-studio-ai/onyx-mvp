'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Play, Loader2, Eye, EyeOff, ArrowLeft, Mail } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { toast } from 'sonner';
import Turnstile from '@/components/Turnstile';

type AuthMode = 'login' | 'signup' | 'forgot';

export default function AuthPage() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [signupEmailSent, setSignupEmailSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (mode === 'signup' && !agreedToTerms) {
      setError(t('errorTermsRequired'));
      setLoading(false);
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError(t('errorPasswordMismatch'));
      setLoading(false);
      return;
    }

    try {
      if (mode === 'login') {
        const cap = await fetch('/api/auth/turnstile-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: captchaToken }),
        });
        if (!cap.ok) { const d = await cap.json().catch(() => ({})); throw new Error(d.error || 'Bot check failed'); }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const isAdmin = email.toLowerCase() === 'admin@onyxstudios.ai';
        router.push(isAdmin ? '/admin/dashboard' : '/dashboard');
      } else if (mode === 'signup') {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, turnstileToken: captchaToken, locale }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Signup failed');
        toast.success(t('toastAccountCreated'));
        setSignupEmailSent(true);
        setPassword('');
        setConfirmPassword('');
      } else if (mode === 'forgot') {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, turnstileToken: captchaToken, locale }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to send reset email');
        }
        setResetEmailSent(true);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'An unexpected error occurred.';
      // Surface the real error to the user. Previous code silently routed
      // Supabase-API-key failures to /dashboard with a fake "Demo Mode: Logged
      // in visually" toast — dangerous after Paddle went live because a real
      // outage would push paying customers into a broken auth state.
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError('');
    setResetEmailSent(false);
    setSignupEmailSent(false);
    setAgreedToTerms(false);
    setConfirmPassword('');
    setCaptchaToken('');
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    // Supabase redirects back to /auth/confirm, which establishes the session and routes to /dashboard.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/confirm` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // On success the browser navigates away to Google — no need to clear loading.
  };

  const titleMap = {
    login: t('titleLogin'),
    signup: t('titleSignup'),
    forgot: t('titleForgot'),
  };

  const subtitleMap = {
    login: t('subtitleLogin'),
    signup: t('subtitleSignup'),
    forgot: t('subtitleForgot'),
  };

  return (
    <main className="min-h-screen bg-[#050505] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <Play className="w-8 h-8 text-blue-400 group-hover:text-blue-300 transition-colors" />
            <span className="text-2xl font-bold text-white tracking-tight">
              {t('brandName')}
            </span>
          </Link>
        </div>

        <Card className="bg-[#0a0a0a] border-white/10">
          <CardHeader className="pb-4">
            {mode === 'forgot' && (
              <button
                onClick={() => switchMode('login')}
                className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm transition-colors mb-3 -mt-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {t('backToSignIn')}
              </button>
            )}
            <CardTitle className="text-white text-2xl text-center">
              {titleMap[mode]}
            </CardTitle>
            <p className="text-gray-400 text-sm text-center mt-1">
              {subtitleMap[mode]}
            </p>
          </CardHeader>

          <CardContent>
            {(resetEmailSent || signupEmailSent) ? (
              <div className="py-6 text-center space-y-5">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <Mail className="w-7 h-7 text-green-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-lg mb-2">{t('checkYourInbox')}</p>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {signupEmailSent ? t('signupEmailSentPrefix') : t('resetEmailSentPrefix')}<br />
                    <span className="text-white font-medium">{email}</span>
                  </p>
                  <p className="text-gray-600 text-xs mt-3">
                    {signupEmailSent ? t('signupEmailSentHint') : t('resetEmailSentHint')}
                  </p>
                </div>
                <button
                  onClick={() => switchMode('login')}
                  className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                >
                  {t('backToSignIn')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-300 text-sm">
                    {t('labelEmail')}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-[#050505] border-white/10 text-white placeholder:text-gray-600 h-11 focus:border-blue-500/50 focus:ring-blue-500/20"
                  />
                </div>

                {mode !== 'forgot' && (
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-gray-300 text-sm">
                      {t('labelPassword')}
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder={t('placeholderPassword')}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
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
                    {mode === 'login' && (
                      <div className="text-right">
                        <button
                          type="button"
                          onClick={() => switchMode('forgot')}
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          {t('forgotPassword')}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {mode === 'signup' && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-gray-300 text-sm">
                      {t('labelConfirmPassword')}
                    </Label>
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={t('placeholderConfirmPassword')}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      className="bg-[#050505] border-white/10 text-white placeholder:text-gray-600 h-11 focus:border-blue-500/50 focus:ring-blue-500/20"
                    />
                  </div>
                )}

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                {mode === 'signup' && (
                  <div className="flex items-start gap-3 rounded-lg border border-white/20 bg-black/20 p-4">
                    <Checkbox
                      id="terms-agreement"
                      checked={agreedToTerms}
                      onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                      disabled={loading}
                      className="mt-0.5 border-white/30 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <Label
                      htmlFor="terms-agreement"
                      className="text-sm text-gray-300 leading-relaxed cursor-pointer"
                    >
                      {t('agreeToPrefix')}{' '}
                      <Link href="/legal/terms" target="_blank" className="text-blue-400 hover:text-blue-300 underline">
                        {t('termsOfService')}
                      </Link>
                      ,{' '}
                      <Link href="/legal/privacy" target="_blank" className="text-blue-400 hover:text-blue-300 underline">
                        {t('privacyPolicy')}
                      </Link>
                      , {t('and')}{' '}
                      <Link href="/legal/aup" target="_blank" className="text-blue-400 hover:text-blue-300 underline">
                        {t('acceptableUsePolicy')}
                      </Link>
                      .
                    </Label>
                  </div>
                )}

                <Turnstile onToken={setCaptchaToken} />

                <Button
                  type="submit"
                  disabled={loading || (mode === 'signup' && !agreedToTerms)}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : mode === 'login' ? (
                    t('buttonSignIn')
                  ) : mode === 'signup' ? (
                    t('buttonCreateAccount')
                  ) : (
                    t('buttonSendResetLink')
                  )}
                </Button>
              </form>
            )}

            {!resetEmailSent && !signupEmailSent && mode !== 'forgot' && (
              <>
                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/10" /></div>
                  <div className="relative flex justify-center"><span className="bg-[#0a0a0a] px-3 text-xs text-gray-500">{t('orContinueWith')}</span></div>
                </div>
                <Button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full h-11 bg-white hover:bg-gray-100 text-gray-800 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                  {t('continueWithGoogle')}
                </Button>
              </>
            )}

            {!resetEmailSent && !signupEmailSent && (
              <div className="mt-6 pt-6 border-t border-white/10 text-center">
                <p className="text-gray-400 text-sm">
                  {mode === 'login' ? t('promptNoAccount') : mode === 'signup' ? t('promptHasAccount') : t('promptRememberPassword')}{' '}
                  <button
                    onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                    className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                  >
                    {mode === 'login' ? t('switchToSignUp') : t('switchToSignIn')}
                  </button>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-gray-600 text-xs text-center mt-6">
          {t('continueAgreementPrefix')}{' '}
          <Link href="/legal/terms" className="text-gray-500 hover:text-gray-400 underline">
            {t('termsOfService')}
          </Link>{' '}
          {t('and')}{' '}
          <Link href="/legal/privacy" className="text-gray-500 hover:text-gray-400 underline">
            {t('privacyPolicy')}
          </Link>
        </p>
      </div>
    </main>
  );
}
