'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Star, Send, Music, Download, Clock } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { toast } from 'sonner';
import Footer from '@/components/landing/Footer';
import { supabase } from '@/lib/supabase';
import { getMusicTierLabel } from '@/lib/config/pricing.config';

function OrderSuccessContent() {
  const t = useTranslations('music.orderSuccess');
  const searchParams = useSearchParams();
  const orderId = searchParams.get('id');

  const [rating, setRating] = useState(0);
  const [missingFeature, setMissingFeature] = useState('');
  const [hearAboutUs, setHearAboutUs] = useState('');
  const [surveySubmitted, setSurveySubmitted] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);

  useEffect(() => {
    if (orderId) {
      loadOrderData();
    }
  }, [orderId]);

  const loadOrderData = async () => {
    try {
      const { data, error } = await supabase
        .from('music_orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (error) throw error;
      setOrderData(data);
    } catch (error) {
      console.error('Error loading order:', error);
    }
  };

  const handleSurveySubmit = async () => {
    if (rating === 0) {
      toast.error(t('pleaseProvideRating'));
      return;
    }

    try {
      console.log('Survey submitted:', {
        orderId,
        rating,
        missingFeature,
        hearAboutUs,
        timestamp: new Date().toISOString()
      });

      setSurveySubmitted(true);
    } catch (error) {
      console.error('Error submitting survey:', error);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white overflow-x-hidden pt-28 pb-20">
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-gradient-to-b from-green-900/10 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-4xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-green-600/20 to-emerald-600/20 border-4 border-green-500/50 mb-6">
              <CheckCircle className="w-12 h-12 text-green-400" />
            </div>

            <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-green-300 to-emerald-400 bg-clip-text text-transparent">
              {t('orderConfirmed')}
            </h1>

            <p className="text-xl text-gray-400 mb-2">
              {t('orderReceived')}
            </p>

            {orderData && (
              <p className="text-sm text-gray-500">
                {t('orderIdLabel')}: {orderId}
              </p>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
          >
            <div className="p-6 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-sm text-center">
              <div className="inline-flex p-4 rounded-full bg-blue-600/20 mb-4">
                <Music className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{t('productionStarted')}</h3>
              <p className="text-sm text-gray-400">
                {t('productionDesc')}
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-sm text-center">
              <div className="inline-flex p-4 rounded-full bg-purple-600/20 mb-4">
                <Clock className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{t('estimatedDelivery')}</h3>
              <p className="text-sm text-gray-400">
                {t('deliveryTime')}
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-sm text-center">
              <div className="inline-flex p-4 rounded-full bg-green-600/20 mb-4">
                <Download className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{t('downloadReady')}</h3>
              <p className="text-sm text-gray-400">
                {t('downloadDesc')}
              </p>
            </div>
          </motion.div>

          {orderData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="p-8 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-sm mb-12"
            >
              <h2 className="text-2xl font-bold text-white mb-6">{t('orderDetails')}</h2>
              <div className="space-y-3 text-gray-300">
                <div className="flex justify-between pb-3 border-b border-white/10">
                  <span className="text-gray-400">{t('emailLabel')}</span>
                  <span className="font-semibold">{orderData.email}</span>
                </div>
                <div className="flex justify-between pb-3 border-b border-white/10">
                  <span className="text-gray-400">{t('vibeLabel')}</span>
                  <span className="font-semibold">{orderData.vibe}</span>
                </div>
                <div className="flex justify-between pb-3 border-b border-white/10">
                  <span className="text-gray-400">{t('usageLabel')}</span>
                  <span className="font-semibold">{orderData.usage_type || t('notSpecified')}</span>
                </div>
                <div className="flex justify-between pb-3 border-b border-white/10">
                  <span className="text-gray-400">{t('productionPlanLabel')}</span>
                  <span className="font-semibold">{getMusicTierLabel(orderData.tier)}</span>
                </div>
                <div className="flex justify-between items-center pt-4">
                  <span className="text-xl font-bold text-white">{t('totalPaidLabel')}</span>
                  <span className="text-3xl font-bold text-green-400">
                    ${orderData.price?.toLocaleString() || '0'}
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {!surveySubmitted ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="p-8 rounded-3xl bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/30 backdrop-blur-sm"
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">{t('helpUsImprove')}</h2>
                <p className="text-gray-400">
                  {t('feedbackDesc')}
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-lg font-bold text-white mb-4 text-center">
                    {t('ratingQuestion')} <span className="text-red-500">*</span>
                  </label>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        className="group transition-transform hover:scale-110 active:scale-95"
                      >
                        <Star
                          className={`w-12 h-12 transition-colors ${
                            star <= rating
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-600 group-hover:text-gray-400'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <p className="text-center text-sm text-gray-500 mt-2">
                    {rating === 0 && t('clickToRate')}
                    {rating === 1 && t('ratingVeryDifficult')}
                    {rating === 2 && t('ratingDifficult')}
                    {rating === 3 && t('ratingOkay')}
                    {rating === 4 && t('ratingEasy')}
                    {rating === 5 && t('ratingVeryEasy')}
                  </p>
                </div>

                <div>
                  <label className="block text-lg font-bold text-white mb-3">
                    {t('missingFeatureLabel')}
                  </label>
                  <textarea
                    value={missingFeature}
                    onChange={(e) => setMissingFeature(e.target.value)}
                    placeholder={t('missingFeaturePlaceholder')}
                    rows={4}
                    className="w-full px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors resize-none"
                  />
                </div>

                <div>
                  <label className="block text-lg font-bold text-white mb-3">
                    {t('hearAboutUsLabel')}
                  </label>
                  <select
                    value={hearAboutUs}
                    onChange={(e) => setHearAboutUs(e.target.value)}
                    className="w-full px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                  >
                    <option value="" className="bg-black">{t('selectOption')}</option>
                    <option value="google" className="bg-black">{t('hearGoogle')}</option>
                    <option value="social-media" className="bg-black">{t('hearSocialMedia')}</option>
                    <option value="friend" className="bg-black">{t('hearFriend')}</option>
                    <option value="youtube" className="bg-black">{t('hearYouTube')}</option>
                    <option value="podcast" className="bg-black">{t('hearPodcast')}</option>
                    <option value="other" className="bg-black">{t('hearOther')}</option>
                  </select>
                </div>

                <button
                  onClick={handleSurveySubmit}
                  disabled={rating === 0}
                  className="w-full px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold hover:from-purple-700 hover:to-pink-700 transition-all duration-300 shadow-lg shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  {t('submitFeedback')}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="p-8 rounded-3xl bg-gradient-to-br from-green-900/20 to-emerald-900/20 border border-green-500/30 backdrop-blur-sm text-center"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-600/20 mb-4">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">{t('thankYou')}</h3>
              <p className="text-gray-400 mb-6">
                {t('feedbackRecorded')}
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 transition-all duration-300"
              >
                {t('goToDashboard')}
              </Link>
            </motion.div>
          )}

          <div className="text-center mt-12">
            <p className="text-gray-400 mb-4">
              {t('questionsAboutOrder')}
            </p>
            <div className="flex justify-center gap-4">
              <Link
                href="/contact"
                className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 transition-all duration-300"
              >
                {t('contactSupport')}
              </Link>
              <Link
                href="/dashboard"
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-300"
              >
                {t('goToDashboard')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <OrderSuccessContent />
    </Suspense>
  );
}
