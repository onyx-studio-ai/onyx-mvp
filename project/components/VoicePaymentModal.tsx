'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { CreditCard, Lock, CheckCircle2, Loader2, Building2, User } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { TAPPAY_CONFIG } from '@/lib/config';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COUNTRIES } from '@/lib/countries';

declare global {
  interface Window {
    TPDirect: any;
  }
}

interface VoicePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  amount: number;
  orderSummary: {
    voice: string;
    tone: string;
    duration: number;
    rightsLevel: string;
  };
  onPaymentSuccess: () => void;
}

export default function VoicePaymentModal({
  isOpen,
  onClose,
  orderId,
  amount,
  orderSummary,
  onPaymentSuccess,
}: VoicePaymentModalProps) {
  const t = useTranslations('payment');
  const tc = useTranslations('common');

  const [isSDKReady, setIsSDKReady] = useState(false);
  const [cardholderName, setCardholderName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [billingType, setBillingType] = useState<'individual' | 'company'>('individual');
  const [billingName, setBillingName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [billingCountry, setBillingCountry] = useState('');
  const [billingAddress, setBillingAddress] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setIsSDKReady(false);
      return;
    }

    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 30;

    const initializeTPDirect = () => {
      if (!isMounted) return;

      if (typeof window === 'undefined' || !window.TPDirect) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(initializeTPDirect, 200);
        } else {
          console.error('TPDirect SDK not loaded after max retries');
          toast.error(t('paymentSystemNotAvailable'));
        }
        return;
      }

      const cardNumberEl = document.getElementById('voice-card-number');
      const expiryEl = document.getElementById('voice-card-expiration-date');
      const ccvEl = document.getElementById('voice-card-ccv');

      if (!cardNumberEl || !expiryEl || !ccvEl) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(initializeTPDirect, 200);
        }
        return;
      }

      if (cardNumberEl.offsetWidth === 0 || cardNumberEl.offsetHeight === 0) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(initializeTPDirect, 200);
        }
        return;
      }

      try {
        const appId = TAPPAY_CONFIG.appId || '166726';
        const appKey = TAPPAY_CONFIG.appKey || 'app_sUtyrCwsegYjYj606VhIX0qzgWGczWjQMVunAKTUkimBYH2MjAzRvwCNwpJZ';

        window.TPDirect.setupSDK(appId, appKey, TAPPAY_CONFIG.environment);

        window.TPDirect.card.setup({
          fields: {
            number: {
              element: '#voice-card-number',
              placeholder: '**** **** **** ****'
            },
            expirationDate: {
              element: '#voice-card-expiration-date',
              placeholder: 'MM / YY'
            },
            ccv: {
              element: '#voice-card-ccv',
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
            ':focus': {
              'color': 'white'
            },
            '.valid': {
              'color': '#10b981'
            },
            '.invalid': {
              'color': '#ef4444'
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
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(initializeTPDirect, 500);
        } else {
          toast.error(t('paymentSystemInitFailed'));
        }
      }
    };

    const initialDelay = setTimeout(() => {
      initializeTPDirect();
    }, 800);

    return () => {
      isMounted = false;
      clearTimeout(initialDelay);
    };
  }, [isOpen]);

  const handlePayment = async () => {
    if (!cardholderName.trim()) {
      toast.error(t('enterCardholderName'));
      return;
    }

    if (!billingName.trim() || !billingEmail.trim() || !billingCountry.trim()) {
      toast.error(t('fillBillingDetails'));
      return;
    }

    if (billingType === 'company' && !companyName.trim()) {
      toast.error(t('enterCompanyName'));
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

    window.TPDirect.card.getPrime(async (result: any) => {
      if (result.status !== 0) {
        console.error('getPrime error:', result);
        toast.error(t('cardValidationFailed'), {
          description: result.msg || t('checkCardDetails')
        });
        setIsProcessing(false);
        return;
      }

      const prime = result.card.prime;

      try {
        const billingDetails = {
          name: billingName,
          email: billingEmail,
          country: billingCountry,
          address: billingAddress,
          billing_type: billingType,
          ...(billingType === 'company' && { company_name: companyName }),
          ...(vatNumber.trim() && { vat_number: vatNumber }),
        };

        const response = await fetch('/api/payment/pay', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prime,
            orderId,
            amount: Number(amount),
            cardholder: {
              name: cardholderName,
            },
            billingDetails,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setOrderNumber(data.orderNumber || orderId);
          toast.success(t('paymentSuccessTitle'), {
            description: data.message || t('checkEmailConfirmation'),
            duration: 4000,
          });
          setPaymentComplete(true);

          onPaymentSuccess();
        } else {
          console.error('❌ [VoicePayment] Payment failed');
          toast.error(t('paymentFailed'), {
            description: data.message || data.error || t('tryAgainOrContact'),
          });
          setIsProcessing(false);
        }
      } catch (error) {
        console.error('Payment error:', error);
        toast.error(t('paymentProcessingError'), {
          description: t('tryAgainOrContact'),
        });
        setIsProcessing(false);
      }
    });
  };

  const handleClose = () => {
    if (!isProcessing) {
      setCardholderName('');
      setPaymentComplete(false);
      setAgreedToTerms(false);
      setBillingType('individual');
      setBillingName('');
      setBillingEmail('');
      setCompanyName('');
      setVatNumber('');
      setBillingCountry('');
      setBillingAddress('');
      onClose();
    }
  };

  const isBillingValid = billingName.trim() && billingEmail.trim() && billingCountry.trim() &&
    (billingType === 'individual' || companyName.trim());
  const isFormValid = cardholderName.trim() && agreedToTerms && isBillingValid;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-gradient-to-br from-gray-900 to-black border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-blue-400" />
            {t('title')}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {orderSummary.voice} &mdash; {orderSummary.duration} min{orderSummary.duration !== 1 ? 's' : ''}{orderSummary.rightsLevel !== 'standard' ? ` + ${orderSummary.rightsLevel === 'global' ? t('globalRights') : t('broadcastRightsLabel')}` : ''} &mdash; ${amount.toFixed(2)}
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
              <h3 className="text-xl font-bold text-white mb-2">{t('paymentSuccessTitle')}</h3>
              {orderNumber && (
                <p className="text-blue-400 font-mono text-sm mb-2">{t('orderPrefix')} #{orderNumber}</p>
              )}
              <p className="text-gray-400 text-sm">{t('checkEmailConfirmation')}</p>
              <p className="text-gray-500 text-xs mt-2">{t('redirectingToDashboard')}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8 py-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                <Building2 className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-semibold text-white">{t('billingDetails')}</h3>
              </div>

              <div className="flex gap-2 p-1 rounded-lg bg-white/[0.04] border border-white/10">
                <button
                  type="button"
                  onClick={() => setBillingType('individual')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${billingType === 'individual' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  <User className="w-4 h-4" />
                  {t('individualTab')}
                </button>
                <button
                  type="button"
                  onClick={() => setBillingType('company')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${billingType === 'company' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  <Building2 className="w-4 h-4" />
                  {t('companyTab')}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white text-sm font-medium flex items-center gap-1">
                    {billingType === 'company' ? t('contactName') : t('fullName')}
                    <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    type="text"
                    value={billingName}
                    onChange={(e) => setBillingName(e.target.value)}
                    placeholder={t('fullNamePlaceholder')}
                    className="bg-black/50 border-white/20 text-white placeholder:text-gray-500 focus:border-blue-500/50"
                    disabled={isProcessing}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-white text-sm font-medium flex items-center gap-1">
                    {t('billingEmail')}
                    <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    placeholder={t('billingEmailPlaceholder')}
                    className="bg-black/50 border-white/20 text-white placeholder:text-gray-500 focus:border-blue-500/50"
                    disabled={isProcessing}
                  />
                </div>
              </div>

              {billingType === 'company' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-white text-sm font-medium flex items-center gap-1">
                      {t('companyName')}
                      <span className="text-red-400">*</span>
                    </Label>
                    <Input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder={t('companyPlaceholder')}
                      className="bg-black/50 border-white/20 text-white placeholder:text-gray-500 focus:border-blue-500/50"
                      disabled={isProcessing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white text-sm font-medium">
                      {t('vatTaxId')}
                      <span className="text-gray-500 text-xs ml-1">({tc('optional')})</span>
                    </Label>
                    <Input
                      type="text"
                      value={vatNumber}
                      onChange={(e) => setVatNumber(e.target.value)}
                      placeholder={t('vatPlaceholder')}
                      className="bg-black/50 border-white/20 text-white placeholder:text-gray-500 focus:border-blue-500/50"
                      disabled={isProcessing}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white text-sm font-medium flex items-center gap-1">
                    {t('country')}
                    <span className="text-red-400">*</span>
                  </Label>
                  <Select
                    value={billingCountry}
                    onValueChange={setBillingCountry}
                    disabled={isProcessing}
                  >
                    <SelectTrigger className="bg-black/50 border-white/20 text-white focus:border-blue-500/50 data-[placeholder]:text-gray-500">
                      <SelectValue placeholder={t('selectCountry')} />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-white/20 text-white max-h-60">
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.name} className="text-white focus:bg-white/10 focus:text-white">
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-white text-sm font-medium">
                    {t('address')}
                    <span className="text-gray-500 text-xs ml-1">({tc('optional')})</span>
                  </Label>
                  <Input
                    type="text"
                    value={billingAddress}
                    onChange={(e) => setBillingAddress(e.target.value)}
                    placeholder={t('addressPlaceholder')}
                    className="bg-black/50 border-white/20 text-white placeholder:text-gray-500 focus:border-blue-500/50"
                    disabled={isProcessing}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                <CreditCard className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-semibold text-white">{t('paymentInformation')}</h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cardholder-name" className="text-white text-sm font-medium flex items-center gap-1">
                    {t('cardholderName')}
                    <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="cardholder-name"
                    type="text"
                    value={cardholderName}
                    onChange={(e) => setCardholderName(e.target.value)}
                    placeholder={t('cardholderPlaceholder')}
                    className="bg-black/50 border-white/20 text-white placeholder:text-gray-500 focus:border-blue-500/50"
                    disabled={isProcessing}
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-white text-sm font-medium">{t('cardNumber')} *</Label>
                  <div
                    id="voice-card-number"
                    className="h-12 flex items-center bg-black/50 border border-white/20 rounded-md px-3 focus-within:border-blue-500/50 transition-colors"
                  ></div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-white text-sm font-medium">{t('expiryDate')} *</Label>
                    <div
                      id="voice-card-expiration-date"
                      className="h-12 flex items-center bg-black/50 border border-white/20 rounded-md px-3 focus-within:border-blue-500/50 transition-colors"
                    ></div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white text-sm font-medium">{t('ccv')} *</Label>
                    <div
                      id="voice-card-ccv"
                      className="h-12 flex items-center bg-black/50 border border-white/20 rounded-md px-3 focus-within:border-blue-500/50 transition-colors"
                    ></div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-400 bg-black/30 p-3 rounded-lg">
                  <Lock className="w-4 h-4" />
                  <span>{t('securedByTapPay')}</span>
                </div>

                <p className="text-xs text-gray-500">
                  {t('testCardInfo')}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="voice-payment-terms-agreement"
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                  disabled={isProcessing}
                  className="mt-0.5 border-white/30 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                />
                <Label
                  htmlFor="voice-payment-terms-agreement"
                  className="text-sm text-gray-300 leading-relaxed cursor-pointer flex items-center gap-1 flex-wrap"
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

            <div className="pt-2 space-y-3">
              <Button
                onClick={handlePayment}
                disabled={!isSDKReady || isProcessing || !isFormValid}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white py-6 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('processingPayment')}
                  </span>
                ) : (
                  t('payAmount', { amount: amount.toFixed(2) })
                )}
              </Button>

              {!isFormValid && (
                <p className="text-xs text-center text-yellow-500">
                  {t('fillRequiredAndTerms')}
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
