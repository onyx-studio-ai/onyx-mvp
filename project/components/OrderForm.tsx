'use client';

import { useState, useRef, useEffect } from 'react';
import { languages, getVoicesForLanguage, Voice } from '@/lib/voices';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Mic2, Sparkles, CheckCircle2, Play, Pause, User, UserRound, Activity, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import PaymentCheckout from '@/components/PaymentCheckout';
import { supabase } from '@/lib/supabase';

interface OrderFormProps {
  selectedPlan?: string;
}

export default function OrderForm({ selectedPlan }: OrderFormProps) {
  const [serviceTier, setServiceTier] = useState(selectedPlan || '');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [selectedVoice, setSelectedVoice] = useState('');
  const [toneStyle, setToneStyle] = useState('Professional');
  const [useCase, setUseCase] = useState('Advertisement');
  const [email, setEmail] = useState('');
  const [emailConfirm, setEmailConfirm] = useState('');
  const [emailConfirmError, setEmailConfirmError] = useState('');
  const [loggedInEmail, setLoggedInEmail] = useState<string | null>(null);
  const [scriptText, setScriptText] = useState('');
  const [sourceLink, setSourceLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [orderAmount, setOrderAmount] = useState(0);

  const serviceTierOptions = ['AI Instant', 'Director\'s Cut', 'Global Casting'];

  const tierPrices: { [key: string]: number } = {
    'AI Instant': 99,
    'Director\'s Cut': 399,
    'Global Casting': 1599
  };

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const availableVoices = getVoicesForLanguage(selectedLanguage);

  const toneOptions = ['Professional', 'Energetic', 'Soothing', 'Movie Trailer', 'Friendly'];
  const useCaseOptions = ['Advertisement', 'Audiobook', 'Social Media', 'E-Learning'];

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setLoggedInEmail(session.user.email);
        setEmail(session.user.email);
        setEmailConfirm(session.user.email);
      }
    });
  }, []);

  useEffect(() => {
    if (selectedPlan) {
      setServiceTier(selectedPlan);
    }
  }, [selectedPlan]);

  useEffect(() => {
    return () => {
      stopCurrentAudio();
    };
  }, []);

  const handleLanguageChange = (newLanguage: string) => {
    setSelectedLanguage(newLanguage);
    setSelectedVoice('');
    stopCurrentAudio();
  };

  const stopCurrentAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
      setPlayingVoiceId(null);
    }
  };

  const toggleAudioPreview = (voice: Voice, e: React.MouseEvent) => {
    e.stopPropagation();

    if (playingVoiceId === voice.id) {
      stopCurrentAudio();
      return;
    }

    stopCurrentAudio();

    const audio = new Audio(voice.audioPreviewUrl);

    audio.addEventListener('ended', () => {
      setPlayingVoiceId(null);
      currentAudioRef.current = null;
    });

    audio.addEventListener('error', (event) => {
      console.error('Audio loading failed:', event);
      setPlayingVoiceId(null);
      currentAudioRef.current = null;
      toast.error('Audio Preview Unavailable', {
        description: `Unable to load preview for ${voice.name}.`,
        duration: 2000,
      });
    });

    audio.play().catch((error) => {
      console.error('Audio playback failed:', error);
      setPlayingVoiceId(null);
      currentAudioRef.current = null;
    });

    currentAudioRef.current = audio;
    setPlayingVoiceId(voice.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loggedInEmail) {
      if (!emailConfirm.trim()) {
        setEmailConfirmError('Please confirm your email address');
        return;
      }
      if (email.trim().toLowerCase() !== emailConfirm.trim().toLowerCase()) {
        setEmailConfirmError('Email addresses do not match');
        return;
      }
    }

    setIsSubmitting(true);

    const orderData = {
      email,
      service_tier: serviceTier,
      language: selectedLanguage,
      voice_selection: selectedVoice,
      tone_style: toneStyle,
      use_case: useCase,
      script_text: scriptText,
      source_link: sourceLink || null,
    };

    console.log('Order submitted:', orderData);

    const amount = tierPrices[serviceTier] || 0;
    setOrderAmount(amount);

    setTimeout(() => {
      setIsSubmitting(false);
      setShowPaymentModal(true);
    }, 500);
  };

  const handlePaymentSuccess = async (prime: string, projectData: any) => {
    console.log('Payment successful! Prime:', prime);
    console.log('Project Data:', projectData);

    try {
      const orderStatus = serviceTier === "Director's Cut" ? 'processing' : 'pending';

      const orderResponse = await fetch('/api/orders/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          language: selectedLanguage,
          voice_selection: selectedVoice,
          tone_style: toneStyle,
          use_case: useCase,
          script_text: scriptText,
          source_link: sourceLink || null,
          status: orderStatus,
          broadcast_rights: projectData.isBroadcastEnabled || false,
        }),
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        console.error('Error saving order:', orderData);
        toast.error('Order Save Failed', {
          description: 'Payment was successful but order could not be saved. Please contact support.',
          duration: 5000,
        });
        return;
      }

      setOrderNumber(orderData.order_number);
      setShowSuccess(true);

      toast.success('Order Completed!', {
        description: 'Your payment was successful and order has been received.',
        duration: 3000,
      });
    } catch (error: any) {
      console.error('Unexpected error:', error);
      toast.error('Error', {
        description: 'An unexpected error occurred. Please contact support.',
        duration: 5000,
      });
    }
  };

  if (showSuccess) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-950/30 to-emerald-950/30 border border-green-500/20 p-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.1),transparent_50%)]" />

          <div className="relative z-10 text-center space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500/20 blur-xl animate-pulse" />
                <CheckCircle2 className="w-20 h-20 text-green-400 relative animate-[scale_0.5s_ease-in-out]" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-3xl font-bold text-white">Order Received!</h3>
              <p className="text-green-300 text-lg font-mono">{orderNumber}</p>
            </div>

            <div className="bg-black/30 rounded-lg p-6 max-w-md mx-auto space-y-2">
              <p className="text-gray-300 text-sm leading-relaxed">
                Your order has been successfully received and payment processed.
              </p>
              <p className="text-gray-400 text-xs">
                We will email you shortly with next steps for your project.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => {
                  window.location.href = '/dashboard';
                }}
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white px-8 py-6 text-lg"
              >
                Track Order Status
              </Button>
              <Button
                onClick={() => {
                  setShowSuccess(false);
                  stopCurrentAudio();
                  setEmail('');
                  setScriptText('');
                  setSourceLink('');
                  setSelectedVoice('');
                  setServiceTier('');
                  setToneStyle('Professional');
                  setUseCase('Advertisement');
                }}
                variant="outline"
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-8 py-6 text-lg border-0"
              >
                Create Another Order
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <PaymentCheckout
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        amount={orderAmount}
        planName={serviceTier}
        onPaymentSuccess={handlePaymentSuccess}
        selectedVoiceId={selectedVoice}
        selectedVoiceName={availableVoices.find(v => v.id === selectedVoice)?.name}
      />

      <div className="w-full max-w-4xl mx-auto">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-black via-gray-950 to-black border border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.05),transparent_70%)]" />

          <div className="relative z-10 p-8 md:p-12">
          <div className="text-center mb-10 space-y-3">
            <div className="flex items-center justify-center gap-2 text-white mb-2">
              <Sparkles className="w-6 h-6 text-blue-400" />
              <h2 className="text-3xl md:text-4xl font-bold">Create Your Order</h2>
              <Sparkles className="w-6 h-6 text-blue-400" />
            </div>
            <p className="text-gray-400 text-sm">Professional AI-powered voice synthesis</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white text-sm font-medium flex items-center gap-2">
                  Email Address
                  <span className="text-red-400">*</span>
                </Label>
                {loggedInEmail ? (
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      readOnly
                      className="bg-black/50 border-white/20 text-gray-400 pr-10 cursor-not-allowed"
                    />
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
                  </div>
                ) : (
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="your@email.com"
                    className="bg-black/50 border-white/20 text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                  />
                )}
              </div>

              {!loggedInEmail && (
                <div className="space-y-2">
                  <Label className="text-white text-sm font-medium flex items-center gap-2">
                    Confirm Email
                    <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={emailConfirm}
                    onChange={(e) => {
                      setEmailConfirm(e.target.value);
                      setEmailConfirmError('');
                    }}
                    placeholder="Re-enter your email"
                    className={`bg-black/50 border-white/20 text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:ring-blue-500/20 ${emailConfirmError ? 'border-red-500/50' : ''}`}
                  />
                  {emailConfirmError && (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {emailConfirmError}
                    </p>
                  )}
                  {emailConfirm && email && email.toLowerCase() === emailConfirm.toLowerCase() && !emailConfirmError && (
                    <p className="text-xs text-green-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Emails match
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="serviceTier" className="text-white text-sm font-medium flex items-center gap-2">
                  Service Tier
                  <span className="text-red-400">*</span>
                </Label>
                <select
                  id="serviceTier"
                  value={serviceTier}
                  onChange={(e) => setServiceTier(e.target.value)}
                  required
                  className="w-full h-10 px-3 rounded-md bg-black/50 border border-white/20 text-white focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none"
                >
                  <option value="">Select a tier...</option>
                  {serviceTierOptions.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier}
                    </option>
                  ))}
                </select>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="language" className="text-white text-sm font-medium flex items-center gap-2">
                  Language
                  <span className="text-red-400">*</span>
                </Label>
                <select
                  id="language"
                  value={selectedLanguage}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  required
                  className="w-full h-10 px-3 rounded-md bg-black/50 border border-white/20 text-white focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="voice" className="text-white text-sm font-medium flex items-center gap-2">
                <Mic2 className="w-4 h-4" />
                Voice Selection
                <span className="text-red-400">*</span>
              </Label>
              <div className="grid sm:grid-cols-2 gap-4">
                {availableVoices.map((voice: Voice) => (
                  <div
                    key={voice.id}
                    onClick={() => setSelectedVoice(voice.id)}
                    className={`
                      relative p-5 rounded-xl border-2 text-left transition-all cursor-pointer group
                      ${
                        selectedVoice === voice.id
                          ? 'border-blue-500 bg-blue-950/30 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                          : 'border-white/10 bg-black/30 hover:border-white/30 hover:bg-black/40'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {voice.gender === 'male' ? (
                          <User className="w-4 h-4 text-blue-400" />
                        ) : (
                          <UserRound className="w-4 h-4 text-pink-400" />
                        )}
                        <div>
                          <p className="text-white font-semibold text-base">{voice.name}</p>
                          <p className="text-xs text-gray-400 uppercase tracking-wider">
                            {voice.gender}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => toggleAudioPreview(voice, e)}
                          className={`
                            relative p-2 rounded-lg transition-all
                            ${
                              playingVoiceId === voice.id
                                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                                : 'bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white'
                            }
                          `}
                          title={playingVoiceId === voice.id ? 'Stop Preview' : 'Play Preview'}
                        >
                          {playingVoiceId === voice.id ? (
                            <Activity className="w-4 h-4 animate-pulse" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </button>
                        {selectedVoice === voice.id && (
                          <CheckCircle2 className="w-5 h-5 text-blue-400" />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {voice.description}
                    </p>
                    {selectedVoice === voice.id && (
                      <div className="absolute inset-0 rounded-xl bg-blue-500/5 pointer-events-none" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="tone" className="text-white text-sm font-medium flex items-center gap-2">
                  Tone / Style
                  <span className="text-red-400">*</span>
                </Label>
                <select
                  id="tone"
                  value={toneStyle}
                  onChange={(e) => setToneStyle(e.target.value)}
                  required
                  className="w-full h-10 px-3 rounded-md bg-black/50 border border-white/20 text-white focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none"
                >
                  {toneOptions.map((tone) => (
                    <option key={tone} value={tone}>
                      {tone}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="useCase" className="text-white text-sm font-medium flex items-center gap-2">
                  Use Case
                  <span className="text-red-400">*</span>
                </Label>
                <select
                  id="useCase"
                  value={useCase}
                  onChange={(e) => setUseCase(e.target.value)}
                  required
                  className="w-full h-10 px-3 rounded-md bg-black/50 border border-white/20 text-white focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none"
                >
                  {useCaseOptions.map((uc) => (
                    <option key={uc} value={uc}>
                      {uc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="script" className="text-white text-sm font-medium flex items-center gap-2">
                Script / Content
                <span className="text-red-400">*</span>
              </Label>
              <Textarea
                id="script"
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                required
                placeholder="Enter the text you want to convert to speech..."
                rows={6}
                className="bg-black/50 border-white/20 text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:ring-blue-500/20 resize-none"
              />
              <p className="text-xs text-gray-500">
                Character count: {scriptText.length}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference" className="text-white text-sm font-medium">
                Reference Link (Optional)
              </Label>
              <Input
                id="reference"
                type="url"
                value={sourceLink}
                onChange={(e) => setSourceLink(e.target.value)}
                placeholder="https://drive.google.com/... or https://dropbox.com/..."
                className="bg-black/50 border-white/20 text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:ring-blue-500/20"
              />
              <p className="text-xs text-gray-500">
                Share reference files via Google Drive or Dropbox
              </p>
            </div>

            <div className="pt-4">
              <Button
                type="submit"
                disabled={isSubmitting || !selectedVoice || !serviceTier}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white py-6 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : (
                  'Submit Order'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
      </div>
    </>
  );
}
