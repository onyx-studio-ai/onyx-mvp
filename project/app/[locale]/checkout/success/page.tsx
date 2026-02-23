'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { CheckCircle, Mail, ExternalLink, Loader2, Home } from 'lucide-react';

interface Order {
  id: string;
  email: string;
  order_number: string;
  price: number;
  status: string;
  payment_status: string;
  user_id: string | null;
}

const ORDER_APIS: { path: string; type: 'music' | 'voice' | 'orchestra' }[] = [
  { path: '/api/orders/music', type: 'music' },
  { path: '/api/orders/voice', type: 'voice' },
  { path: '/api/orders/orchestra', type: 'orchestra' },
];

function CheckoutSuccessContent() {
  const t = useTranslations('checkoutSuccess');
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get('id');

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const [orderType, setOrderType] = useState<'music' | 'voice' | 'orchestra'>('music');

  useEffect(() => {
    if (orderId) {
      loadOrder();
    }
  }, [orderId]);

  const loadOrder = async () => {
    try {
      let found: Order | null = null;

      for (const api of ORDER_APIS) {
        const res = await fetch(`${api.path}?id=${orderId}`);
        if (res.ok) {
          found = await res.json();
          setOrderType(api.type);
          break;
        }
      }

      if (!found) throw new Error('Order not found');

      setOrder(found);
      setIsNewUser(found.user_id === null);
    } catch (error) {
      console.error('Error loading order:', error);
    } finally {
      setLoading(false);
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
          <p className="text-white text-xl">{t('orderNotFound')}</p>
          <Link href="/" className="text-purple-400 hover:text-purple-300 mt-4 inline-block">
            {t('returnToHome')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white pt-28 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 mb-6">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-green-200 via-emerald-200 to-green-400 bg-clip-text text-transparent">
            {t('paymentSuccessful')}
          </h1>

          <p className="text-xl text-gray-400 mb-8">
            {t('thankYou')}
          </p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-8 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-sm mb-8"
          >
            <div className="space-y-4 text-left">
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-gray-400">{t('orderNumber')}</span>
                <span className="text-white font-mono font-semibold">{order.order_number}</span>
              </div>

              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-gray-400">{t('emailLabel')}</span>
                <span className="text-white">{order.email}</span>
              </div>

              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-gray-400">{t('amountPaid')}</span>
                <span className="text-2xl font-bold text-green-400">US${order.price.toLocaleString()}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400">{t('statusLabel')}</span>
                <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-semibold">
                  {order.payment_status === 'completed' ? t('paid') : order.status}
                </span>
              </div>
            </div>
          </motion.div>

          {isNewUser && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-6 rounded-2xl bg-blue-500/10 border border-blue-500/30 mb-8"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-blue-500/20">
                  <Mail className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-lg font-bold text-white mb-2">{t('checkYourEmail')}</h3>
                  <p className="text-gray-300 text-sm mb-3">
                    {t('magicLinkMessage', { email: order.email })}
                  </p>
                  <p className="text-gray-400 text-xs">
                    {t('magicLinkClickPrompt')}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-4"
          >
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold hover:from-purple-700 hover:to-pink-700 transition-all duration-300 shadow-lg shadow-purple-500/50"
            >
              {t('goToDashboard')}
              <ExternalLink className="w-5 h-5" />
            </Link>

            <div className="text-center">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <Home className="w-4 h-4" />
                {t('returnToHome')}
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-12 p-6 rounded-2xl bg-gradient-to-br from-purple-900/10 to-pink-900/10 border border-purple-500/20"
          >
            <h3 className="text-lg font-bold text-white mb-3">{t('whatHappensNext')}</h3>
            <div className="space-y-3 text-sm text-gray-300 text-left max-w-lg mx-auto">
              {orderType === 'orchestra' ? (
                <>
                  {([1, 2, 3, 4, 5] as const).map((step) => (
                    <div key={step} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center flex-shrink-0 text-xs font-bold">{step}</div>
                      <p>{t(`orchestraStep${step}`)}</p>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {([1, 2, 3, 4, 5] as const).map((step) => (
                    <div key={step} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center flex-shrink-0 text-xs font-bold">{step}</div>
                      <p>{t(`regularStep${step}`)}</p>
                    </div>
                  ))}
                </>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-8 text-center text-sm text-gray-500"
          >
            <p>{t('needHelp')}</p>
          </motion.div>
        </motion.div>
      </div>
    </main>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
