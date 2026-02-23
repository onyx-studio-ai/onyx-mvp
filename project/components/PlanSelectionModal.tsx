'use client';

import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface Plan {
  name: string;
  price: number;
  priceUnit: string;
  priceLabel?: string;
  priceNote?: string;
  minOrder?: string;
  description: string;
  features: string[];
  highlighted: boolean;
  isCustom: boolean;
  buttonText: string;
  badge: string | null;
  badgeStyle: string | null;
}

const plans: Plan[] = [
  {
    name: 'AI Instant',
    price: 3,
    priceUnit: 'deposit',
    minOrder: '(Minimum Deposit)',
    description: 'Self-service. Ready in seconds.',
    features: [
      'Instant Delivery',
      'AI Generation',
      'Standard License (Web)',
      'MP3 / WAV Download',
      'Self-Service Editing',
      'No Revisions',
    ],
    highlighted: false,
    isCustom: false,
    buttonText: 'Start with Minimum Order (US$3.00)',
    badge: null,
    badgeStyle: null,
  },
  {
    name: 'Director\'s Cut',
    price: 50,
    priceUnit: 'base fee',
    priceNote: '(Final cost calculated after script)',
    description: 'Pro-tuned realism. Studio quality.',
    features: [
      '24-48 Hours Delivery',
      'Human Director Review',
      'Emotional Logic Tuning',
      'Broadcast Quality (Mix)',
      'Includes 1 Revision',
    ],
    highlighted: true,
    isCustom: false,
    buttonText: 'Pay Base Fee to Start (US$50.00)',
    badge: 'MOST POPULAR',
    badgeStyle: 'gold',
  },
  {
    name: 'Global Casting',
    price: 300,
    priceUnit: 'project',
    priceLabel: 'Custom Quote',
    priceNote: '(Starts from US$300)',
    description: 'Real human artists. Bespoke casting.',
    features: [
      '3-7 Days Delivery',
      'Real Human Recording',
      'Custom Casting Service',
      'Full Buyout Rights',
      'Direct Director Session',
      'Unlimited Revisions',
    ],
    highlighted: false,
    isCustom: true,
    buttonText: 'Contact Agent',
    badge: 'PREMIUM',
    badgeStyle: 'premium',
  },
];

interface PlanSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan: (planName: string, price: number) => void;
  onContactClick: () => void;
  selectedVoiceName?: string;
}

export default function PlanSelectionModal({
  isOpen,
  onClose,
  onSelectPlan,
  onContactClick,
  selectedVoiceName,
}: PlanSelectionModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gradient-to-br from-gray-900 to-black border-white/10 text-white max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold text-center">
            Choose Your
            <span className="bg-gradient-to-r from-white via-gray-300 to-gray-500 bg-clip-text text-transparent">
              {' '}Sound Level
            </span>
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-center">
            {selectedVoiceName && (
              <span className="text-yellow-300 font-semibold">
                Selected Voice: {selectedVoiceName}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {plans.map((plan) => (
            <div key={plan.name} className="relative">
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                  <div className={`text-white text-xs font-bold px-4 py-1.5 rounded-full ${
                    plan.badgeStyle === 'gold'
                      ? 'bg-gradient-to-r from-yellow-600 to-amber-500 shadow-[0_0_20px_rgba(251,191,36,0.6)]'
                      : plan.badgeStyle === 'premium'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-500 shadow-[0_0_20px_rgba(168,85,247,0.6)]'
                      : 'bg-blue-600 shadow-[0_0_20px_rgba(59,130,246,0.5)]'
                  }`}>
                    {plan.badge}
                  </div>
                </div>
              )}

              <div
                className={`relative h-full rounded-xl border-2 p-6 transition-all duration-300 ${
                  plan.highlighted
                    ? 'border-yellow-500/50 bg-gradient-to-b from-yellow-950/20 to-[#0f0f0f] shadow-[0_0_30px_rgba(251,191,36,0.2)]'
                    : 'border-gray-800 bg-gradient-to-b from-[#0a0a0a] to-[#0f0f0f]'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <Sparkles className={`h-8 w-8 ${plan.highlighted ? 'text-yellow-400' : 'text-gray-400'}`} />
                </div>

                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <p className="text-gray-400 text-xs mb-4">{plan.description}</p>

                <div className="mb-6">
                  {plan.isCustom ? (
                    <>
                      <span className="text-3xl font-bold">{plan.priceLabel}</span>
                      <span className="text-xs text-gray-500 block mt-1">{plan.priceNote}</span>
                    </>
                  ) : plan.priceLabel ? (
                    <>
                      <div>
                        <span className="text-sm text-gray-400">{plan.priceLabel} </span>
                        <span className="text-4xl font-bold">US${plan.price}</span>
                        <span className="text-xs text-gray-400"> / {plan.priceUnit}</span>
                      </div>
                      {plan.priceNote && (
                        <span className="text-xs text-gray-500 block mt-1">{plan.priceNote}</span>
                      )}
                    </>
                  ) : (
                    <>
                      <div>
                        <span className="text-4xl font-bold">US${plan.price}</span>
                        <span className="text-xs text-gray-400"> / {plan.priceUnit}</span>
                      </div>
                      {plan.minOrder && (
                        <span className="text-xs text-gray-500 block mt-1">{plan.minOrder}</span>
                      )}
                    </>
                  )}
                </div>

                <Button
                  onClick={() => plan.isCustom ? onContactClick() : onSelectPlan(plan.name, plan.price)}
                  className={`w-full py-5 rounded-lg font-semibold transition-all duration-300 text-sm ${
                    plan.highlighted
                      ? 'bg-gradient-to-r from-yellow-600 to-amber-500 hover:from-yellow-700 hover:to-amber-600 text-white'
                      : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                  }`}
                >
                  {plan.buttonText}
                </Button>

                <div className="mt-6 space-y-2">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-gray-300 text-xs leading-relaxed">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
