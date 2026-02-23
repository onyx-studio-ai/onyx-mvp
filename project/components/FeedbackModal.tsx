'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Gift } from 'lucide-react';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string, comment?: string) => void;
}

const FEEDBACK_REASON_IDS = ['robotic', 'glitch', 'pronunciation', 'other'] as const;

export default function FeedbackModal({ isOpen, onClose, onSubmit }: FeedbackModalProps) {
  const t = useTranslations('feedback');
  const tc = useTranslations('common');
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) return;

    setIsSubmitting(true);
    await onSubmit(selectedReason, comment.trim() || undefined);
    setIsSubmitting(false);
    setSelectedReason(null);
    setComment('');
  };

  const handleClose = () => {
    setSelectedReason(null);
    setComment('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-[#0a0a0a] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{t('whatsWrong')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="grid grid-cols-2 gap-2">
            {FEEDBACK_REASON_IDS.map((reasonId) => (
              <button
                key={reasonId}
                onClick={() => setSelectedReason(reasonId)}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  selectedReason === reasonId
                    ? 'bg-blue-600 text-white border-2 border-blue-500'
                    : 'bg-white/5 text-gray-300 border-2 border-white/10 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                {t(reasonId)}
              </button>
            ))}
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">
              {t('additionalDetails')}
            </label>
            <Textarea
              placeholder={t('tellUsMore')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="bg-[#050505] border-white/10 text-white placeholder:text-gray-600 min-h-[100px] focus:border-blue-500/50 focus:ring-blue-500/20"
            />
          </div>

          <div className="bg-gradient-to-r from-green-950/30 to-blue-950/30 border border-green-900/40 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/20">
                <Gift className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-300">{t('freeRetry')}</p>
                <p className="text-xs text-gray-400">{t('reviewFeedback')}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleClose}
              variant="ghost"
              className="flex-1 text-gray-400 hover:text-white hover:bg-white/10"
            >
              {tc('cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedReason || isSubmitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t('submitting') : t('submitFeedback')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
