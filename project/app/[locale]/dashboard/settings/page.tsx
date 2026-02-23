'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDashboard } from '@/contexts/DashboardContext';
import { supabase } from '@/lib/supabase';
import { Loader2, User as UserIcon, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const t = useTranslations('dashboard.settings');
  const { user, refreshUser } = useDashboard();
  const meta = user.user_metadata || {};

  const [fullName, setFullName] = useState(meta.full_name || '');
  const [companyName, setCompanyName] = useState(meta.company_name || '');
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          company_name: companyName,
        },
      });
      if (error) throw error;
      await refreshUser();
      toast.success(t('profileUpdated'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      toast.error(t('updateFailed'), { description: message });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error(t('passwordTooShort'), { description: t('passwordTooShortDesc') });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('passwordsMismatch'));
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success(t('passwordUpdated'));
      try {
        await fetch('/api/mail/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflow: 'password_changed',
            type: 'password_changed',
            email: user.email,
            category: 'SUPPORT',
          }),
        });
      } catch { /* non-critical */ }
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      toast.error(t('updateFailed'), { description: message });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="text-white p-6 lg:p-10">
      <div className="max-w-lg">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">{t('accountSettings')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('manageProfile')}</p>
        </div>

        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <UserIcon className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{t('profileInformation')}</h2>
              <p className="text-gray-500 text-xs">{t('identityDesc')}</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5 font-medium">{t('labelEmail')}</label>
              <input
                type="email"
                value={user.email || ''}
                disabled
                className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 text-gray-500 text-sm cursor-not-allowed"
              />
              <p className="text-[11px] text-gray-600 mt-1.5">{t('emailCannotChange')}</p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5 font-medium">{t('labelFullName')}</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Alex Chen"
                className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-sm placeholder:text-gray-600 focus:border-blue-500/50 outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5 font-medium">{t('labelCompanyName')}</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Onyx Studio"
                className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-sm placeholder:text-gray-600 focus:border-blue-500/50 outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {t('buttonSaveChanges')}
            </button>
          </form>
        </div>
        <div className="my-8 border-t border-white/[0.06]" />

        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{t('securityAndPassword')}</h2>
              <p className="text-gray-500 text-xs">{t('passwordDesc')}</p>
            </div>
          </div>

          <form onSubmit={handlePasswordUpdate} className="space-y-5">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5 font-medium">{t('labelNewPassword')}</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('minCharacters')}
                  className="w-full bg-black border border-white/10 rounded-lg p-3 pr-10 text-white text-sm placeholder:text-gray-600 focus:border-emerald-500/50 outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5 font-medium">{t('labelConfirmNewPassword')}</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('reEnterPassword')}
                  className="w-full bg-black border border-white/10 rounded-lg p-3 pr-10 text-white text-sm placeholder:text-gray-600 focus:border-emerald-500/50 outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingPassword || !newPassword || !confirmPassword}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {savingPassword && <Loader2 size={14} className="animate-spin" />}
              {t('buttonUpdatePassword')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
