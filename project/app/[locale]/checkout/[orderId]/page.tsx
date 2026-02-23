'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, CheckCircle, Lock, CreditCard, Building, User, Shield } from 'lucide-react';
import { TAPPAY_CONFIG } from '@/lib/config';
import { getVoiceTierLabel, getMusicTierLabel } from '@/lib/config/pricing.config';
import { COUNTRIES, getDialCode } from '@/lib/countries';

type OrderType = 'music' | 'voice' | 'orchestra';

interface Order {
  id: string;
  email: string;
  tier: string;
  price: number;
  talent_id: string | null;
  talent_price: number;
  status: string;
  payment_status?: string;
  // music-specific
  vibe?: string;
  reference_link?: string;
  usage_type?: string;
  description?: string;
  string_addon?: string | null;
  // voice-specific
  language?: string;
  voice_selection?: string;
  tone_style?: string;
  use_case?: string;
  script_text?: string;
  project_name?: string;
  order_number?: string;
  // orchestra-specific
  tier_name?: string;
  duration_minutes?: number;
  genre?: string;
}

interface BillingDetails {
  type: 'individual' | 'company';
  fullName?: string;
  companyName?: string;
  vatNumber?: string;
  country: string;
  region: string;
}

interface LicenseeDetails {
  type: 'individual' | 'company';
  name: string;
  taxId: string;
  contactPerson: string;
  email: string;
  phone: string;
  country: string;
}


export default function CheckoutPage() {
  const t = useTranslations('checkout');
  const tc = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;

  const searchParamsHook = useSearchParams();
  const orderType = (searchParamsHook.get('type') || 'music') as OrderType;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [tappayReady, setTappayReady] = useState(false);
  const [orderLoaded, setOrderLoaded] = useState(false);
  const cardSetupDone = useRef(false);

  const [billing, setBilling] = useState<BillingDetails>({
    type: 'individual',
    fullName: '',
    companyName: '',
    vatNumber: '',
    country: '',
    region: '',
  });
  const [licenseeSameAsBilling, setLicenseeSameAsBilling] = useState(true);
  const [licensee, setLicensee] = useState<LicenseeDetails>({
    type: 'individual',
    name: '',
    taxId: '',
    contactPerson: '',
    email: '',
    phone: '',
    country: '',
  });
  const [phoneDialCode, setPhoneDialCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  useEffect(() => {
    loadTapPaySDK();
  }, []);

  useEffect(() => {
    if (tappayReady && orderLoaded) {
      setupCardFields();
    }
  }, [tappayReady, orderLoaded]);

  const loadOrder = async () => {
    try {
      const apiPath = orderType === 'orchestra'
        ? '/api/orders/orchestra'
        : orderType === 'voice'
          ? '/api/orders/voice'
          : '/api/orders/music';
      const response = await fetch(`${apiPath}?id=${orderId}`);
      if (!response.ok) throw new Error('Order not found');
      const data = await response.json();
      if (data.status !== 'pending_payment') { router.push('/'); return; }
      setOrder(data);
      setOrderLoaded(true);
    } catch (error) {
      console.error('Error loading order:', error);
      setError(t('orderNotFound'));
    } finally {
      setLoading(false);
    }
  };

  const loadTapPaySDK = () => {
    if (typeof window === 'undefined') return;

    const initSDK = () => {
      if ((window as any).TPDirect) {
        try {
          (window as any).TPDirect.setupSDK(
            TAPPAY_CONFIG.appId,
            TAPPAY_CONFIG.appKey,
            TAPPAY_CONFIG.environment
          );
        } catch (e) {
          console.warn('TPDirect setupSDK error (may already be initialized):', e);
        }
        setTappayReady(true);
        return true;
      }
      return false;
    };

    if (initSDK()) return;

    const existingScript = document.querySelector('script[src*="tappaysdk.com"]');
    if (existingScript) {
      let attempts = 0;
      const poll = setInterval(() => {
        attempts++;
        if (initSDK() || attempts > 50) clearInterval(poll);
      }, 200);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.tappaysdk.com/tpdirect/v5.18.0';
    script.async = true;

    script.onload = () => { initSDK(); };
    script.onerror = () => { console.error('Failed to load TapPay SDK'); };

    document.body.appendChild(script);
  };

  const setupCardFields = () => {
    if (typeof window === 'undefined' || !(window as any).TPDirect) return;

    cardSetupDone.current = false;

    let retryCount = 0;
    const maxRetries = 30;

    const setup = () => {
      const cardNumber = document.getElementById('card-number');
      const cardExpiration = document.getElementById('card-expiration-date');
      const cardCcv = document.getElementById('card-ccv');

      if (!cardNumber || !cardExpiration || !cardCcv) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(setup, 300);
        }
        return;
      }

      if (cardNumber.offsetWidth === 0 || cardNumber.offsetHeight === 0) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(setup, 300);
        }
        return;
      }

      const hasExistingIframe = cardNumber.querySelector('iframe');
      if (hasExistingIframe) {
        cardSetupDone.current = true;
        return;
      }

      if (cardSetupDone.current) return;
      cardSetupDone.current = true;

      try {
        (window as any).TPDirect.card.setup({
          fields: {
            number: {
              element: '#card-number',
              placeholder: '**** **** **** ****',
            },
            expirationDate: {
              element: '#card-expiration-date',
              placeholder: 'MM / YY',
            },
            ccv: {
              element: '#card-ccv',
              placeholder: 'CCV',
            },
          },
          styles: {
            input: {
              color: '#ffffff',
              'font-size': '16px',
              'font-family': 'Inter, sans-serif',
            },
            ':focus': {
              color: '#ffffff',
            },
            '.valid': {
              color: '#10b981',
            },
            '.invalid': {
              color: '#ef4444',
            },
          },
          isMaskCreditCardNumber: true,
          maskCreditCardNumberRange: {
            beginIndex: 6,
            endIndex: 11,
          },
        });
      } catch (err) {
        console.error('Error setting up card fields:', err);
        cardSetupDone.current = false;
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(setup, 500);
        }
      }
    };

    setTimeout(setup, 500);
  };

  const getEffectiveLicensee = (): LicenseeDetails => {
    if (licenseeSameAsBilling) {
      return {
        type: billing.type,
        name: billing.type === 'individual' ? (billing.fullName || '') : (billing.companyName || ''),
        taxId: billing.vatNumber || '',
        contactPerson: billing.type === 'company' ? (billing.fullName || '') : '',
        email: order?.email || '',
        phone: '',
        country: billing.country,
      };
    }
    return licensee;
  };

  const validateBilling = () => {
    if (billing.type === 'individual' && !billing.fullName?.trim()) {
      setError(t('validationFullName'));
      return false;
    }

    if (billing.type === 'company') {
      if (!billing.companyName?.trim()) {
        setError(t('validationCompanyName'));
        return false;
      }
    }

    if (!billing.country) {
      setError(t('validationCountry'));
      return false;
    }

    const lic = licenseeSameAsBilling ? null : licensee;
    if (lic) {
      if (!lic.name.trim()) {
        setError(t('validationLicenseeName'));
        return false;
      }
      if (!lic.email.trim()) {
        setError(t('validationLicenseeEmail'));
        return false;
      }
      if (!lic.country) {
        setError(t('validationLicenseeCountry'));
        return false;
      }
      if (lic.type === 'company' && !lic.contactPerson.trim()) {
        setError(t('validationLicenseeContact'));
        return false;
      }
    }

    return true;
  };

  const handlePayment = async () => {
    if (!validateBilling()) return;

    setIsProcessing(true);
    setError('');

    try {
      if (typeof window !== 'undefined' && (window as any).TPDirect && tappayReady) {
        const tappayStatus = (window as any).TPDirect.card.getTappayFieldsStatus();

        if (!tappayStatus.canGetPrime) {
          setError(t('validationCardInfo'));
          setIsProcessing(false);
          return;
        }

        (window as any).TPDirect.card.getPrime((result: any) => {
          if (result.status !== 0) {
            setError(t('invalidCardInfo'));
            setIsProcessing(false);
            return;
          }

          processPayment(result.card.prime).catch((err) => {
            console.error('Payment error:', err);
            setError(t('paymentProcessingFailed'));
            setIsProcessing(false);
          });
        });
      } else {
        setError(t('paymentSystemNotReady'));
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Payment error:', error);
      setError(t('paymentProcessingFailed'));
      setIsProcessing(false);
    }
  };

  const processPayment = async (prime: string | null) => {
    try {

          const effectiveLicensee = getEffectiveLicensee();
          const response = await fetch('/api/payment/pay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prime,
          orderId,
          amount: Number(order?.price) || 0,
          cardholder: {
            name: billing.type === 'individual' ? billing.fullName : billing.companyName,
          },
          orderType,
          orderEmail: order?.email || '',
          orderNumber: order?.order_number || orderId,
          billingDetails: billing,
          licenseeDetails: effectiveLicensee,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        router.push(`/checkout/success?id=${orderId}`);
      } else {
        setError(data.message || t('paymentFailed'));
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      setError(t('paymentProcessingFailed'));
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-white text-xl">{t('orderNotFound')}</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white pt-28 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 mb-6">
            <Lock className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-purple-200 via-pink-200 to-purple-400 bg-clip-text text-transparent">
            {t('secureCheckout')}
          </h1>
          <p className="text-xl text-gray-400">{t('completeOrderSecurely')}</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-8 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-sm"
            >
              <h2 className="text-2xl font-bold mb-6 text-white">{t('billingInformation')}</h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-white mb-3">
                    {t('billingType')} <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setBilling({ ...billing, type: 'individual' })}
                      className={`p-4 rounded-xl border transition-all duration-200 ${
                        billing.type === 'individual'
                          ? 'bg-purple-600/20 border-purple-500 text-white'
                          : 'bg-white/5 border-white/10 text-gray-300 hover:border-purple-500/50'
                      }`}
                    >
                      <User className="w-6 h-6 mx-auto mb-2" />
                      <div className="font-semibold">{t('individual')}</div>
                    </button>
                    <button
                      onClick={() => setBilling({ ...billing, type: 'company' })}
                      className={`p-4 rounded-xl border transition-all duration-200 ${
                        billing.type === 'company'
                          ? 'bg-purple-600/20 border-purple-500 text-white'
                          : 'bg-white/5 border-white/10 text-gray-300 hover:border-purple-500/50'
                      }`}
                    >
                      <Building className="w-6 h-6 mx-auto mb-2" />
                      <div className="font-semibold">{t('company')}</div>
                    </button>
                  </div>
                </div>

                {billing.type === 'individual' ? (
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">
                      {t('fullName')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={billing.fullName}
                      onChange={(e) => setBilling({ ...billing, fullName: e.target.value })}
                      placeholder="John Doe"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-white mb-2">
                        {t('companyName')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={billing.companyName}
                        onChange={(e) => setBilling({ ...billing, companyName: e.target.value })}
                        placeholder="Acme Inc."
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-white mb-2">
                        {t('vatNumberOptional')}
                      </label>
                      <input
                        type="text"
                        value={billing.vatNumber}
                        onChange={(e) => setBilling({ ...billing, vatNumber: e.target.value })}
                        placeholder="EU123456789"
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    {t('countryRegion')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={billing.country}
                    onChange={(e) => setBilling({ ...billing, country: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50"
                  >
                    <option value="" className="bg-black">{t('selectCountry')}</option>
                    {COUNTRIES.map((country) => (
                      <option key={country.code} value={country.name} className="bg-black">
                        {country.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    {t('stateRegionOptional')}
                  </label>
                  <input
                    type="text"
                    value={billing.region}
                    onChange={(e) => setBilling({ ...billing, region: e.target.value })}
                    placeholder="California"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>
            </motion.div>

            {/* License Recipient */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="p-8 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-sm"
            >
              <h2 className="text-2xl font-bold mb-2 text-white flex items-center gap-2">
                <Shield className="w-6 h-6" />
                {t('licenseRecipient')}
              </h2>
              <p className="text-sm text-gray-500 mb-6">{t('licenseRecipientDescription')}</p>

              <label className="flex items-center gap-3 cursor-pointer group mb-6">
                <div className="relative flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={licenseeSameAsBilling}
                    onChange={(e) => setLicenseeSameAsBilling(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center ${
                      licenseeSameAsBilling
                        ? 'bg-purple-500 border-purple-500'
                        : 'bg-white/5 border-white/20 group-hover:border-white/40'
                    }`}
                  >
                    {licenseeSameAsBilling && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-sm text-gray-300">{t('sameAsBilling')}</span>
              </label>

              {!licenseeSameAsBilling && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-white mb-3">
                      {t('licenseeType')} <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setLicensee({ ...licensee, type: 'individual' })}
                        className={`p-4 rounded-xl border transition-all duration-200 ${
                          licensee.type === 'individual'
                            ? 'bg-purple-600/20 border-purple-500 text-white'
                            : 'bg-white/5 border-white/10 text-gray-300 hover:border-purple-500/50'
                        }`}
                      >
                        <User className="w-6 h-6 mx-auto mb-2" />
                        <div className="font-semibold">{t('individual')}</div>
                      </button>
                      <button
                        onClick={() => setLicensee({ ...licensee, type: 'company' })}
                        className={`p-4 rounded-xl border transition-all duration-200 ${
                          licensee.type === 'company'
                            ? 'bg-purple-600/20 border-purple-500 text-white'
                            : 'bg-white/5 border-white/10 text-gray-300 hover:border-purple-500/50'
                        }`}
                      >
                        <Building className="w-6 h-6 mx-auto mb-2" />
                        <div className="font-semibold">{t('company')}</div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">
                      {licensee.type === 'company' ? t('companyName') : t('fullLegalName')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={licensee.name}
                      onChange={(e) => setLicensee({ ...licensee, name: e.target.value })}
                      placeholder={licensee.type === 'company' ? 'Acme Corporation Ltd.' : 'John Doe'}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>

                  {licensee.type === 'company' && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-white mb-2">
                          {t('taxRegistrationNumber')} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={licensee.taxId}
                          onChange={(e) => setLicensee({ ...licensee, taxId: e.target.value })}
                          placeholder="e.g. 12345678 / VAT123456789 / EIN 12-3456789"
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50"
                        />
                        <p className="text-xs text-gray-500 mt-1">{t('taxIdHint')}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-white mb-2">
                          {t('contactPerson')} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={licensee.contactPerson}
                          onChange={(e) => setLicensee({ ...licensee, contactPerson: e.target.value })}
                          placeholder="Name of the person handling this project"
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">
                      {t('contactEmail')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={licensee.email}
                      onChange={(e) => setLicensee({ ...licensee, email: e.target.value })}
                      placeholder="license-holder@company.com"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">
                    {t('licenseeCountry')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={licensee.country}
                      onChange={(e) => {
                        const countryName = e.target.value;
                        setLicensee({ ...licensee, country: countryName });
                        const dial = getDialCode(countryName);
                        if (dial) setPhoneDialCode(dial);
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50"
                    >
                      <option value="" className="bg-black">{t('selectCountry')}</option>
                      {COUNTRIES.map((country) => (
                        <option key={country.code} value={country.name} className="bg-black">
                          {country.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">
                      {t('mobileNumber')}
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={phoneDialCode}
                        onChange={(e) => {
                          const newDial = e.target.value;
                          setPhoneDialCode(newDial);
                          const full = newDial && phoneNumber.trim() ? `${newDial} ${phoneNumber.trim()}` : '';
                          setLicensee((prev) => ({ ...prev, phone: full }));
                        }}
                        className="w-[120px] flex-shrink-0 px-3 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/50"
                      >
                        <option value="" className="bg-black">Code</option>
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.dialCode} className="bg-black">
                            {c.dialCode} {c.code}
                          </option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={phoneNumber}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/[^\d\s]/g, '');
                          setPhoneNumber(digits);
                          const full = phoneDialCode && digits.trim() ? `${phoneDialCode} ${digits.trim()}` : '';
                          setLicensee((prev) => ({ ...prev, phone: full }));
                        }}
                        placeholder="912 345 678"
                        className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                  </div>
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-8 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-sm"
            >
              <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
                <CreditCard className="w-6 h-6" />
                {t('paymentInformation')}
              </h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    {t('cardNumber')} <span className="text-red-500">*</span>
                  </label>
                  <div
                    id="card-number"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 min-h-[48px] flex items-center"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">
                      {t('expirationDate')} <span className="text-red-500">*</span>
                    </label>
                    <div
                      id="card-expiration-date"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 min-h-[48px] flex items-center"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">
                      {t('ccv')} <span className="text-red-500">*</span>
                    </label>
                    <div
                      id="card-ccv"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 min-h-[48px] flex items-center"
                    />
                  </div>
                </div>

                {!tappayReady && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('loadingPaymentFields')}</span>
                  </div>
                )}

                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                  <p className="text-xs text-blue-400">
                    {t('testCardInfo')}
                  </p>
                </div>

                {error && (
                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                    <p className="text-sm text-red-400 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </p>
                  </div>
                )}

                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative flex-shrink-0 mt-0.5">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center ${
                        agreedToTerms
                          ? 'bg-green-500 border-green-500'
                          : 'bg-white/5 border-white/20 group-hover:border-white/40'
                      }`}
                    >
                      {agreedToTerms && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-gray-400 leading-relaxed">
                    {tc('agreePrefix')}{' '}
                    <a href="/legal/terms" target="_blank" className="text-white underline underline-offset-2 hover:text-gray-200 transition-colors">{tc('termsOfService')}</a>
                    {', '}
                    <a href="/legal/privacy" target="_blank" className="text-white underline underline-offset-2 hover:text-gray-200 transition-colors">{tc('privacyPolicy')}</a>
                    {', '}
                    <a href="/legal/aup" target="_blank" className="text-white underline underline-offset-2 hover:text-gray-200 transition-colors">{tc('acceptableUsePolicy')}</a>
                  </span>
                </label>

                <button
                  onClick={handlePayment}
                  disabled={isProcessing || !tappayReady || !agreedToTerms}
                  className="w-full px-8 py-4 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg shadow-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t('processingPayment')}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      {t('completePaymentPrefix')} US${Number(order.price).toLocaleString()}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="p-6 rounded-3xl bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/30 backdrop-blur-sm"
              >
                <h3 className="text-xl font-bold text-white mb-4">{t('orderSummary')}</h3>

                <div className="space-y-3 mb-6 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">{t('orderTypeLabel')}</span>
                    <span className="text-white font-semibold capitalize">{orderType === 'orchestra' ? t('liveStrings') : orderType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">{orderType === 'orchestra' ? t('stringSetup') : t('servicePlan')}</span>
                    <span className="text-white font-semibold">
                      {orderType === 'voice' ? getVoiceTierLabel(order.tier) : orderType === 'orchestra' ? (order.tier_name || order.tier) : getMusicTierLabel(order.tier)}
                    </span>
                  </div>
                  {orderType === 'orchestra' && order.duration_minutes && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t('duration')}</span>
                      <span className="text-amber-300">{order.duration_minutes} min</span>
                    </div>
                  )}
                  {orderType === 'orchestra' && order.project_name && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t('project')}</span>
                      <span className="text-white">{order.project_name}</span>
                    </div>
                  )}
                  {orderType === 'voice' && order.language && (
                    <div className="flex justify-between">
                    <span className="text-gray-400">{t('language')}</span>
                    <span className="text-blue-300">{order.language}</span>
                  </div>
                )}
                {orderType === 'voice' && order.voice_selection && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">{t('voice')}</span>
                      <span className="text-blue-300">{order.voice_selection}</span>
                    </div>
                  )}
                  {order.string_addon && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t('stringRecording')}</span>
                      <span className="text-amber-400">{order.string_addon}</span>
                    </div>
                  )}
                  {order.talent_id && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">{orderType === 'voice' ? t('voiceTalent') : t('inHouseVocalist')}</span>
                      <span className="text-pink-400">US${Number(order.talent_price).toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-white/10">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white font-bold">{t('total')}</span>
                    <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                      US${Number(order.price).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{t('includesAllFees')}</p>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
