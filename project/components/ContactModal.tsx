'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMessage?: string;
  department?: 'HELLO' | 'PRODUCTION' | 'SUPPORT' | 'BILLING' | 'ADMIN';
  source?: string;
}

export default function ContactModal({
  isOpen,
  onClose,
  defaultMessage = '',
  department = 'HELLO',
  source = 'general',
}: ContactModalProps) {
  const t = useTranslations('contactModal');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(defaultMessage);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [inquiryNumber, setInquiryNumber] = useState('');

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error(t('errorFillAllFields'));
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/contact/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message, department, source }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send inquiry');
      }

      setInquiryNumber(data.inquiryNumber);
      setSent(true);
      toast.success(t('successSent'));
    } catch (err) {
      console.error('[ContactModal] Send error:', err);
      toast.error('Failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setName('');
    setEmail('');
    setMessage(defaultMessage);
    setSending(false);
    setSent(false);
    setInquiryNumber('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] bg-[#0a0a0a] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {sent ? t('titleSubmitted') : t('title')}
          </DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="py-8 text-center space-y-4">
            <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto" />
            <div>
              <p className="text-lg font-semibold text-white mb-2">Thank you, {name}!</p>
              <p className="text-gray-400 text-sm mb-4">
                Your inquiry has been received and routed to our team.
              </p>
            </div>
            {inquiryNumber && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 inline-block">
                <p className="text-xs text-gray-500 mb-1">Reference Number</p>
                <p className="text-emerald-400 text-lg font-mono font-bold tracking-wider">
                  {inquiryNumber}
                </p>
              </div>
            )}
            <p className="text-gray-500 text-xs">
              A confirmation email has been sent to your inbox.
              <br />We typically respond within 24 business hours.
            </p>
            <Button
              onClick={handleClose}
              className="mt-4 bg-white/10 hover:bg-white/15 text-white"
            >
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('nameLabel')}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                disabled={sending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('emailLabel')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                disabled={sending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">{t('messageLabel')}</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('messagePlaceholder')}
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 min-h-[120px]"
                disabled={sending}
              />
            </div>

            <div className="pt-4">
              <Button
                onClick={handleSubmit}
                disabled={sending}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-base font-semibold disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-5 w-5" />
                    {t('sendInquiry')}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
