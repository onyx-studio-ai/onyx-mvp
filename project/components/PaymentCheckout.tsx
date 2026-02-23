'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { CreditCard, Lock, CheckCircle2, FileText, User, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { TAPPAY_CONFIG } from '@/lib/config';

declare global {
  interface Window {
    TPDirect: any;
  }
}

interface PaymentCheckoutProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  planName: string;
  onPaymentSuccess: (prime: string, projectData: any) => void;
  selectedVoiceId?: string;
  selectedVoiceName?: string;
}

export default function PaymentCheckout({
  isOpen,
  onClose,
  amount,
  planName,
  onPaymentSuccess,
  selectedVoiceId,
  selectedVoiceName
}: PaymentCheckoutProps) {
  const t = useTranslations('payment');
  const tc = useTranslations('common');

  const [isSDKReady, setIsSDKReady] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [projectBrief, setProjectBrief] = useState('');
  const [scriptText, setScriptText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [isBroadcastEnabled, setIsBroadcastEnabled] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsSDKReady(false);
      return;
    }

    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 10;

    const initializeTPDirect = () => {
      if (!isMounted) return;

      if (typeof window === 'undefined' || !window.TPDirect) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(initializeTPDirect, 100);
        } else {
          console.error('TPDirect SDK not loaded after max retries');
          toast.error(t('paymentSystemNotAvailable'));
        }
        return;
      }

      const cardNumberEl = document.getElementById('card-number');
      const expiryEl = document.getElementById('card-expiration-date');
      const ccvEl = document.getElementById('card-ccv');

      if (!cardNumberEl || !expiryEl || !ccvEl) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(initializeTPDirect, 150);
        } else {
          console.error('TapPay card elements not found in DOM after max retries');
          toast.error(t('paymentFormInitFailed'));
        }
        return;
      }

      if (cardNumberEl.offsetWidth === 0 || cardNumberEl.offsetHeight === 0) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(initializeTPDirect, 150);
        }
        return;
      }

      try {
        window.TPDirect.setupSDK(
          Number(TAPPAY_CONFIG.appId),
          TAPPAY_CONFIG.appKey,
          TAPPAY_CONFIG.environment
        );

        window.TPDirect.card.setup({
          fields: {
            number: {
              element: '#card-number',
              placeholder: '**** **** **** ****'
            },
            expirationDate: {
              element: '#card-expiration-date',
              placeholder: 'MM / YY'
            },
            ccv: {
              element: '#card-ccv',
              placeholder: 'CCV'
            }
          },
          styles: {
            'input': {
              'color': 'white',
              'font-size': '16px',
              'font-family': 'inherit',
              'background-color': 'transparent'
            },
            'input.ccv': {
              'font-size': '16px'
            },
            ':focus': {
              'color': 'white'
            },
            '.valid': {
              'color': '#10b981'
            },
            '.invalid': {
              'color': '#ef4444'
            },
            '@media screen and (max-width: 400px)': {
              'input': {
                'font-size': '14px'
              }
            }
          },
          isMaskCreditCardNumber: true,
          maskCreditCardNumberRange: {
            beginIndex: 6,
            endIndex: 11
          }
        });

        if (isMounted) {
          setIsSDKReady(true);
        }
      } catch (error) {
        console.error('TPDirect initialization error:', error);
        toast.error(t('paymentSystemInitFailed'));
      }
    };

    const initialDelay = setTimeout(() => {
      initializeTPDirect();
    }, 600);

    return () => {
      isMounted = false;
      clearTimeout(initialDelay);
    };
  }, [isOpen]);

  const handlePayment = async () => {
    if (!name || !email) {
      toast.error(t('fillAllRequired'));
      return;
    }

    if (!projectBrief || projectBrief.trim().length < 10) {
      toast.error(t('projectBriefMinChars'));
      return;
    }

    if (!scriptText || scriptText.trim().length < 10) {
      toast.error(t('scriptMinChars'));
      return;
    }

    if (!agreedToTerms) {
      toast.error(t('agreeToTermsRequired'));
      return;
    }

    if (!window.TPDirect) {
      toast.error(t('paymentSystemNotReady'));
      return;
    }

    const tappayStatus = window.TPDirect.card.getTappayFieldsStatus();

    if (tappayStatus.canGetPrime === false) {
      toast.error(t('enterValidCard'));
      return;
    }

    setIsProcessing(true);

    window.TPDirect.card.getPrime((result: any) => {
      if (result.status !== 0) {
        console.error('getPrime error:', result);
        toast.error(t('cardValidationFailed'), {
          description: result.msg || t('checkCardDetails')
        });
        setIsProcessing(false);
        return;
      }

      const prime = result.card.prime;

      const finalAmount = isBroadcastEnabled ? amount + 300 : amount;

      const projectData = {
        name,
        email,
        projectBrief,
        scriptText,
        planName,
        amount: finalAmount,
        isBroadcastEnabled,
        ...(selectedVoiceId && { voiceId: selectedVoiceId }),
        ...(selectedVoiceName && { voiceName: selectedVoiceName })
      };

      toast.success(t('paymentAuthorized'), {
        description: t('primeTokenSuccess'),
        duration: 3000,
      });

      setPaymentComplete(true);

      setTimeout(() => {
        onPaymentSuccess(prime, projectData);
        setIsProcessing(false);
        setPaymentComplete(false);
        setName('');
        setEmail('');
        setProjectBrief('');
        setScriptText('');
        setIsBroadcastEnabled(false);
        setAgreedToTerms(false);
        onClose();
      }, 2000);
    });
  };

  const handleClose = () => {
    if (!isProcessing) {
      setName('');
      setEmail('');
      setProjectBrief('');
      setScriptText('');
      setPaymentComplete(false);
      setIsBroadcastEnabled(false);
      setAgreedToTerms(false);
      onClose();
    }
  };

  const isFormValid = name.trim() && email.trim() && projectBrief.trim().length >= 10 && scriptText.trim().length >= 10 && agreedToTerms;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-gradient-to-br from-gray-900 to-black border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-400" />
            {t('bookYourProject')}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {planName} - ${amount}
          </DialogDescription>
        </DialogHeader>

        {paymentComplete ? (
          <div className="py-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500/20 blur-xl animate-pulse" />
                <CheckCircle2 className="w-16 h-16 text-green-400 relative" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">{t('orderReceived')}</h3>
              <p className="text-gray-400 text-sm">{t('emailNextSteps')}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8 py-4">
            {/* Section A: Project Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                <User className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-semibold text-white">{t('projectDetails')}</h3>
              </div>

              {selectedVoiceId && selectedVoiceName && (
                <div className="rounded-lg border border-yellow-500/50 bg-gradient-to-r from-yellow-600/10 to-amber-600/10 p-3">
                  <div className="flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-medium text-white">
                      {t('voiceLabel')} <span className="text-yellow-300">{selectedVoiceName}</span>
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-white text-sm font-medium flex items-center gap-1">
                    {t('nameLabel')}
                    <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('fullName')}
                    className="bg-black/50 border-white/20 text-white placeholder:text-gray-500 focus:border-blue-500/50"
                    disabled={isProcessing}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white text-sm font-medium flex items-center gap-1">
                    {t('emailLabel')}
                    <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="bg-black/50 border-white/20 text-white placeholder:text-gray-500 focus:border-blue-500/50"
                    disabled={isProcessing}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project-brief" className="text-white text-sm font-medium flex items-center gap-1">
                    {t('projectBrief')}
                    <span className="text-red-400">*</span>
                  </Label>
                  <Textarea
                    id="project-brief"
                    value={projectBrief}
                    onChange={(e) => setProjectBrief(e.target.value)}
                    placeholder={t('projectBriefPlaceholder')}
                    rows={4}
                    className="bg-black/50 border-white/20 text-white placeholder:text-gray-500 focus:border-blue-500/50 resize-none"
                    disabled={isProcessing}
                  />
                  <p className="text-xs text-gray-500">
                    {projectBrief.length} {t('characters')} {projectBrief.length < 10 && t('minimumRequired', { min: 10 })}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="script-text" className="text-white text-sm font-medium flex items-center gap-1">
                    {t('scriptTextToVoice')}
                    <span className="text-red-400">*</span>
                  </Label>
                  <Textarea
                    id="script-text"
                    value={scriptText}
                    onChange={(e) => setScriptText(e.target.value)}
                    placeholder={t('scriptPlaceholder')}
                    rows={6}
                    className="bg-black/50 border-white/20 text-white placeholder:text-gray-500 focus:border-blue-500/50 resize-none font-mono text-sm"
                    disabled={isProcessing}
                  />
                  <p className="text-xs text-gray-500">
                    {scriptText.length} {t('characters')} {scriptText.length < 10 && t('minimumRequired', { min: 10 })}
                  </p>
                </div>
              </div>
            </div>

            {/* Section B: Payment */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                <CreditCard className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-semibold text-white">{t('paymentInformation')}</h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-white text-sm font-medium">{t('cardNumber')} *</Label>
                  <div
                    id="card-number"
                    className="h-12 flex items-center bg-black/50 border border-white/20 rounded-md px-3 focus-within:border-blue-500/50 transition-colors"
                  ></div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-white text-sm font-medium">{t('expiryDate')} *</Label>
                    <div
                      id="card-expiration-date"
                      className="h-12 flex items-center bg-black/50 border border-white/20 rounded-md px-3 focus-within:border-blue-500/50 transition-colors"
                    ></div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white text-sm font-medium">{t('ccv')} *</Label>
                    <div
                      id="card-ccv"
                      className="h-12 flex items-center bg-black/50 border border-white/20 rounded-md px-3 focus-within:border-blue-500/50 transition-colors"
                    ></div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-400 bg-black/30 p-3 rounded-lg">
                  <Lock className="w-4 h-4" />
                  <span>{t('securedByTapPay')}</span>
                </div>
              </div>
            </div>

            {/* Broadcast Rights Add-on */}
            <div className="rounded-lg border border-white/20 bg-gradient-to-br from-black/40 to-gray-900/40 p-4 space-y-2">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="broadcast-rights"
                  checked={isBroadcastEnabled}
                  onCheckedChange={(checked) => setIsBroadcastEnabled(checked === true)}
                  disabled={isProcessing}
                  className="mt-1 border-white/30 data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-yellow-600 data-[state=checked]:to-amber-500 data-[state=checked]:border-yellow-500"
                />
                <div className="flex-1 space-y-1">
                  <Label
                    htmlFor="broadcast-rights"
                    className="text-white font-medium cursor-pointer leading-tight"
                  >
                    {t('addBroadcastRights')}
                  </Label>
                  <p className="text-xs text-gray-400">
                    {t('broadcastRightsDesc')}
                  </p>
                </div>
              </div>
            </div>

            {/* Legal Agreement */}
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="payment-terms-agreement"
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                  disabled={isProcessing}
                  className="mt-0.5 border-white/30 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                />
                <Label
                  htmlFor="payment-terms-agreement"
                  className="text-sm text-gray-300 leading-relaxed cursor-pointer flex items-center gap-1"
                >
                  {tc('agreePrefix')}{' '}
                  <Link href="/legal/terms" target="_blank" className="text-blue-400 hover:text-blue-300 underline">
                    {tc('termsOfService')}
                  </Link>
                  ,{' '}
                  <Link href="/legal/privacy" target="_blank" className="text-blue-400 hover:text-blue-300 underline">
                    {tc('privacyPolicy')}
                  </Link>
                  , {tc('and')}{' '}
                  <Link href="/legal/aup" target="_blank" className="text-blue-400 hover:text-blue-300 underline">
                    {tc('acceptableUsePolicy')}
                  </Link>
                  <span className="text-red-400">*</span>
                </Label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-3">
              <Button
                onClick={handlePayment}
                disabled={!isSDKReady || isProcessing || !isFormValid}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white py-6 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {tc('processing')}
                  </span>
                ) : (
                  t('bookProjectPayAmount', { amount: isBroadcastEnabled ? amount + 300 : amount })
                )}
              </Button>

              {!isFormValid && (
                <p className="text-xs text-center text-yellow-500">
                  {t('fillRequiredFields')}
                </p>
              )}

              <Button
                onClick={handleClose}
                variant="ghost"
                disabled={isProcessing}
                className="w-full border border-white/20 text-white hover:bg-white/5 hover:text-white"
              >
                {tc('cancel')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
