'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { X, Check, ArrowRight, ArrowLeft, Loader2, Mic2, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { languages, getVoicesForLanguage } from '@/lib/voices';
import { toast } from 'sonner';
import VoicePaymentModal from '@/components/VoicePaymentModal';
import { supabase } from '@/lib/supabase';
import { estimateAudioMinutes, calculatePrice } from '@/lib/estimateAudio';
import { VOICE_RIGHTS_PRICING, VOICE_RIGHTS_LABELS, type VoiceRightsLevel, getVoiceRightsAddonPrice } from '@/lib/config/pricing.config';

const TIERS = [
  { id: 'tier-1', nameKey: 'tierName1', descKey: 'tierDesc1', priceKey: 'tierPrice1' },
  { id: 'tier-2', nameKey: 'tierName2', descKey: 'tierDesc2', priceKey: 'tierPrice2' },
];

const TONES = [
  { value: 'Professional', labelKey: 'toneLabel1', descKey: 'toneDesc1' },
  { value: 'Energetic', labelKey: 'toneLabel2', descKey: 'toneDesc2' },
  { value: 'Soothing', labelKey: 'toneLabel3', descKey: 'toneDesc3' },
  { value: 'Movie Trailer', labelKey: 'toneLabel4', descKey: 'toneDesc4' },
  { value: 'Friendly', labelKey: 'toneLabel5', descKey: 'toneDesc5' },
];

const USE_CASES = [
  { value: 'Advertisement', labelKey: 'useCaseOptionLabel1', descKey: 'useCaseOptionDesc1' },
  { value: 'Social Media', labelKey: 'useCaseOptionLabel2', descKey: 'useCaseOptionDesc2' },
  { value: 'E-Learning', labelKey: 'useCaseOptionLabel3', descKey: 'useCaseOptionDesc3' },
  { value: 'Audiobook', labelKey: 'useCaseOptionLabel4', descKey: 'useCaseOptionDesc4' },
];

interface OrderWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTier?: string;
  preSelectedVoice?: string;
  preSelectedVoiceId?: string;
  preSelectedLanguage?: string;
}

export const OrderWizardModal = ({
  isOpen,
  onClose,
  selectedTier = 'tier-1',
  preSelectedVoice,
  preSelectedVoiceId,
  preSelectedLanguage,
}: OrderWizardModalProps) => {
  const router = useRouter();
  const t = useTranslations('orderWizard');
  const tc = useTranslations('common');
  const [step, setStep] = useState(1);
  const [tier, setTier] = useState(selectedTier);
  const [language, setLanguage] = useState(preSelectedLanguage || 'en');
  const [voiceId, setVoiceId] = useState(preSelectedVoiceId || '');
  const [config, setConfig] = useState({ tone: '', useCase: '' });
  const [script, setScript] = useState('');
  const [rightsLevel, setRightsLevel] = useState<VoiceRightsLevel>('standard');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emailConfirm, setEmailConfirm] = useState('');
  const [emailConfirmError, setEmailConfirmError] = useState('');
  const [loggedInEmail, setLoggedInEmail] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderId, setOrderId] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number } | null>(null);
  const [promoError, setPromoError] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const availableVoices = useMemo(() => getVoicesForLanguage(language), [language]);
  const resolvedVoiceName = preSelectedVoice || availableVoices.find(v => v.id === voiceId)?.name || '';

  const estimatedMinutes = estimateAudioMinutes(script);
  const basePrice = calculatePrice(estimatedMinutes, tier as 'tier-1' | 'tier-2');
  const rightsAddonPrice = getVoiceRightsAddonPrice(tier, rightsLevel);
  const subtotal = basePrice + rightsAddonPrice;
  const discountAmount = appliedPromo ? subtotal * (appliedPromo.discount / 100) : 0;
  const finalPrice = subtotal - discountAmount;

  const langName = languages.find(l => l.code === language)?.name || language;

  const step1Valid = config.tone && config.useCase && (preSelectedVoice || voiceId);
  const step2Valid = script.trim().length >= 10;
  const step3Valid = name.trim() && email.trim();

  const handleApplyPromo = async () => {
    const code = promoCode.trim().toUpperCase();
    setPromoError('');

    if (!code) return;

    try {
      const res = await fetch('/api/promos/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      if (res.ok && data.valid) {
        setAppliedPromo({ code: data.code, discount: data.discount });
        toast.success(t('promoApplied', { discount: data.discount }));
      } else {
        setPromoError(data.error || t('promoInvalid'));
        toast.error(data.error || t('promoInvalid'));
      }
    } catch {
      setPromoError(t('promoValidationFailed'));
      toast.error(t('promoValidationFailed'));
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setLoggedInEmail(session.user.email);
        setEmail(session.user.email);
        setEmailConfirm(session.user.email);
      }
    });
  }, []);

  const resetState = () => {
    setStep(1);
    setTier(selectedTier);
    setLanguage(preSelectedLanguage || 'en');
    setVoiceId(preSelectedVoiceId || '');
    setConfig({ tone: '', useCase: '' });
    setScript('');
    setRightsLevel('standard');
    setName('');
    setEmail('');
    setOrderComplete(false);
    setOrderNumber('');
    setOrderId('');
    setPromoCode('');
    setAppliedPromo(null);
    setPromoError('');
    setIsPaymentModalOpen(false);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetState();
    onClose();
  };

  const handleSubmit = async () => {
    if (!email.trim()) {
      toast.error(t('emailRequired'));
      return;
    }
    if (!loggedInEmail) {
      if (!emailConfirm.trim()) {
        setEmailConfirmError(t('confirmEmailRequired'));
        return;
      }
      if (email.trim().toLowerCase() !== emailConfirm.trim().toLowerCase()) {
        setEmailConfirmError(t('emailMismatch'));
        return;
      }
    }
    if (!step3Valid) return;
    setIsSubmitting(true);

    try {
      const projectName = `${tier === 'tier-1' ? 'AI' : 'Director'} Voiceover - ${new Date().toLocaleDateString()}`;

      const response = await fetch('/api/orders/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          language: langName,
          voice_selection: resolvedVoiceName,
          script_text: script,
          tone_style: config.tone,
          use_case: config.useCase,
          broadcast_rights: rightsLevel !== 'standard',
          rights_level: rightsLevel,
          tier,
          duration: estimatedMinutes,
          price: finalPrice,
          project_name: projectName,
          status: 'draft',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create order');
      }

      if (!data?.id) {
        throw new Error('Failed to create order');
      }

      setOrderId(data.id);
      setOrderNumber(data.order_number || '');
      setIsPaymentModalOpen(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      toast.error(t('orderCreationFailed'), { description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentSuccess = () => {
    setIsPaymentModalOpen(false);
    router.push(`/checkout/success?id=${orderId}`);
  };

  if (!isOpen) return null;

  const STEP_LABELS = [t('steps.config'), t('steps.script'), t('steps.checkout')];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0a0a0a] border border-white/10 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-white/10 bg-white/[0.02]">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-white">
                {orderComplete ? t('orderConfirmed') : `${step}. ${STEP_LABELS[step - 1]}`}
              </h2>
              {!orderComplete && (
                <p className="text-xs text-gray-500 mt-1">
                  {tier === 'tier-1' ? t('tierSubtitle1') : t('tierSubtitle2')}
                </p>
              )}
            </div>
            <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition">
              <X size={20} />
            </button>
          </div>

          {!orderComplete && (
            <div className="flex gap-2 mt-4">
              {STEP_LABELS.map((_, i) => (
                <div key={i} className="flex-1">
                  <div className={`h-1 rounded-full transition-colors ${i + 1 <= step ? 'bg-blue-500' : 'bg-white/10'}`} />
                </div>
              ))}
            </div>
          )}

          {preSelectedVoice && !orderComplete && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Mic2 className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs text-blue-300 font-medium">
                {t('voiceLabel')}：<span className="text-white">{preSelectedVoice}</span>
              </span>
            </div>
          )}
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {orderComplete ? (
            <div className="py-8 text-center space-y-5">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">{t('orderReceived')}</h3>
                {orderNumber && <p className="text-sm text-gray-400 font-mono">{orderNumber}</p>}
                <p className="text-gray-500 text-sm mt-3 max-w-sm mx-auto">
                  {t('checkEmailMagicLink')}
                </p>
              </div>
              <button onClick={handleClose} className="px-6 py-2.5 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/[0.15] transition">
                {tc('close')}
              </button>
            </div>
          ) : step === 1 ? (
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-gray-400 mb-2 font-medium">{t('serviceTierLabel')}</label>
                <div className="grid grid-cols-2 gap-3">
                  {TIERS.map((tierItem) => (
                    <button
                      key={tierItem.id}
                      type="button"
                      onClick={() => setTier(tierItem.id)}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        tier === tierItem.id
                          ? 'border-blue-500/50 bg-blue-500/10'
                          : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                      }`}
                    >
                      <p className="text-white text-sm font-semibold">{t(tierItem.nameKey)}</p>
                      <p className="text-[11px] text-gray-500 mt-1">{t(tierItem.priceKey)}</p>
                    </button>
                  ))}
                </div>
              </div>

              {!preSelectedVoice && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2 font-medium">{t('languageLabel')}</label>
                    <select
                      className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-sm focus:border-blue-500/50 outline-none"
                      value={language}
                      onChange={(e) => { setLanguage(e.target.value); setVoiceId(''); }}
                    >
                      {languages.map((l) => (
                        <option key={l.code} value={l.code}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2 font-medium">{t('voiceLabel')}</label>
                    <select
                      className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-sm focus:border-blue-500/50 outline-none"
                      value={voiceId}
                      onChange={(e) => setVoiceId(e.target.value)}
                    >
                      <option value="">{t('selectVoicePlaceholder')}</option>
                      {availableVoices.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-400 mb-2 font-medium">{t('targetToneLabel')}</label>
                <select
                  className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-sm focus:border-blue-500/50 outline-none"
                  value={config.tone}
                  onChange={(e) => setConfig({ ...config, tone: e.target.value })}
                >
                  <option value="">{t('selectTonePlaceholder')}</option>
                  {TONES.map((toneItem) => (
                    <option key={toneItem.value} value={toneItem.value}>{t(toneItem.labelKey)}</option>
                  ))}
                </select>
                {config.tone && (
                  <p className="text-xs text-green-400/80 mt-2">{t(TONES.find(ti => ti.value === config.tone)?.descKey ?? '')}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2 font-medium">{t('useCaseLabel')}</label>
                <select
                  className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-sm focus:border-blue-500/50 outline-none"
                  value={config.useCase}
                  onChange={(e) => setConfig({ ...config, useCase: e.target.value })}
                >
                  <option value="">{t('selectUseCasePlaceholder')}</option>
                  {USE_CASES.map((u) => (
                    <option key={u.value} value={u.value}>{t(u.labelKey)}</option>
                  ))}
                </select>
                {config.useCase && (
                  <p className="text-xs text-green-400/80 mt-2">{t(USE_CASES.find(u => u.value === config.useCase)?.descKey ?? '')}</p>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  disabled={!step1Valid}
                  onClick={() => setStep(2)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium text-sm disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 transition"
                >
                  {tc('next')} <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ) : step === 2 ? (
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-gray-400 mb-2 font-medium">{t('pasteScriptLabel')}</label>
                <textarea
                  className="w-full h-40 bg-black border border-white/10 rounded-lg p-4 text-white text-sm focus:border-blue-500/50 outline-none font-mono resize-none"
                  placeholder={t('scriptPlaceholder')}
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                />
              </div>

              {script.trim().length >= 10 && (
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">{t('estimatedAudioLength')}</span>
                    <span className="text-white font-semibold">{estimatedMinutes} {estimatedMinutes !== 1 ? t('minutesUnit') : t('minuteUnit')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">{t('totalPrice')}</span>
                    <span className="text-white font-mono font-bold text-lg">US${basePrice.toFixed(0)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-2">
                <button onClick={() => setStep(1)} className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition">
                  <ArrowLeft size={16} /> {tc('back')}
                </button>
                <button
                  disabled={!step2Valid}
                  onClick={() => setStep(3)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium text-sm disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 transition"
                >
                  {t('steps.checkout')} <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-2 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>{t('voiceLabel')}</span>
                  <span className="text-white text-right">{resolvedVoiceName}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>{t('targetToneLabel')}</span>
                  <span className="text-white">{config.tone}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>{t('estimatedAudioLength')}</span>
                  <span className="text-white">{estimatedMinutes} {estimatedMinutes !== 1 ? t('minutesUnit') : t('minuteUnit')}</span>
                </div>
                <div className="h-px bg-white/10 my-2" />
                <div className="flex justify-between text-gray-400">
                  <span>{t('serviceTierLabel')}</span>
                  <span className="text-white">US${basePrice.toFixed(2)}</span>
                </div>
                {rightsAddonPrice > 0 && (
                  <div className="flex justify-between text-gray-400">
                    <span>{VOICE_RIGHTS_LABELS[rightsLevel].name}</span>
                    <span className="text-white">+US${rightsAddonPrice.toFixed(2)}</span>
                  </div>
                )}
                {appliedPromo && (
                  <div className="flex justify-between text-green-400">
                    <span>{appliedPromo.code} (-{appliedPromo.discount}%)</span>
                    <span>-US${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="h-px bg-white/10 my-2" />
                <div className="flex justify-between text-lg font-bold text-white">
                  <span>{t('totalPrice')}</span>
                  <span>US${finalPrice.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-gray-400 font-medium">{t('promoCodeLabel')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 bg-black border border-white/10 rounded-lg p-3 text-white text-sm uppercase focus:border-blue-500/50 outline-none placeholder:normal-case"
                    placeholder={t('promoPlaceholder')}
                    value={promoCode}
                    onChange={(e) => {
                      setPromoCode(e.target.value);
                      setPromoError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
                    disabled={!!appliedPromo}
                  />
                  <button
                    onClick={appliedPromo ? () => {
                      setAppliedPromo(null);
                      setPromoCode('');
                      toast.success(t('promoRemoved'));
                    } : handleApplyPromo}
                    disabled={!promoCode.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    {appliedPromo ? tc('remove') : tc('apply')}
                  </button>
                </div>
                {promoError && (
                  <p className="text-xs text-red-400">{promoError}</p>
                )}
                {appliedPromo && (
                  <p className="text-xs text-green-400">{t('promoCodeAppliedText', { discount: appliedPromo.discount })}</p>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5 font-medium">{t('nameLabel')}</label>
                  <input
                    type="text"
                    className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-sm focus:border-blue-500/50 outline-none"
                    placeholder={t('namePlaceholder')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5 font-medium">{t('emailLabel')}</label>
                  {loggedInEmail ? (
                    <div className="relative">
                      <input
                        type="email"
                        className="w-full bg-black border border-white/10 rounded-lg p-3 text-gray-400 text-sm pr-10 cursor-not-allowed"
                        value={email}
                        readOnly
                      />
                      <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
                    </div>
                  ) : (
                    <input
                      type="email"
                      className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-sm focus:border-blue-500/50 outline-none"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  )}
                </div>
                {!loggedInEmail && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5 font-medium">{t('confirmEmailLabel')}</label>
                    <input
                      type="email"
                      className={`w-full bg-black border rounded-lg p-3 text-white text-sm focus:border-blue-500/50 outline-none ${emailConfirmError ? 'border-red-500/50' : 'border-white/10'}`}
                      placeholder={t('confirmEmailPlaceholder')}
                      value={emailConfirm}
                      onChange={(e) => {
                        setEmailConfirm(e.target.value);
                        setEmailConfirmError('');
                      }}
                    />
                    {emailConfirmError && (
                      <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                        <AlertCircle size={12} />
                        {emailConfirmError}
                      </p>
                    )}
                    {emailConfirm && email && email.toLowerCase() === emailConfirm.toLowerCase() && !emailConfirmError && (
                      <p className="mt-1 text-xs text-green-400 flex items-center gap-1">
                        <CheckCircle size={12} />
                        {t('emailsMatch')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">{t('usageRightsLabel')}</p>
                {(['standard', 'broadcast', 'global'] as VoiceRightsLevel[]).map(level => {
                  const addonPrice = getVoiceRightsAddonPrice(tier, level);
                  const isSelected = rightsLevel === level;
                  const label = VOICE_RIGHTS_LABELS[level];
                  const isIncluded = addonPrice === 0 && level !== 'standard';
                  return (
                    <label
                      key={level}
                      className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition ${
                        isSelected ? 'border-green-500/40 bg-green-500/5' : 'border-white/10 hover:bg-white/[0.02]'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 transition flex-shrink-0 ${
                        isSelected ? 'bg-green-500 border-green-500' : 'border-gray-600'
                      }`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <input type="radio" className="hidden" name="rights" checked={isSelected} onChange={() => setRightsLevel(level)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">{label.name}</span>
                          {isIncluded && <span className="text-green-400 text-xs font-medium">{tc('included')}</span>}
                          {addonPrice > 0 && <span className="text-amber-400 text-xs font-medium">+${addonPrice}</span>}
                        </div>
                        <span className="text-xs text-gray-500">{label.description}</span>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="flex justify-between pt-2">
                <button onClick={() => setStep(2)} className="text-gray-400 hover:text-white text-sm flex items-center gap-1 transition">
                  <ArrowLeft size={16} /> {tc('back')}
                </button>
                <button
                  disabled={!step3Valid || isSubmitting}
                  onClick={handleSubmit}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-medium text-sm disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 transition"
                >
                  {isSubmitting ? (
                    <><Loader2 size={16} className="animate-spin" /> {tc('submitting')}</>
                  ) : (
                    t('submitOrderButton', { amount: finalPrice.toFixed(2) })
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <VoicePaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        orderId={orderId}
        amount={finalPrice}
        orderSummary={{
          voice: resolvedVoiceName,
          tone: config.tone,
          duration: estimatedMinutes,
          rightsLevel,
        }}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
};
