'use client';

import { useTranslations } from 'next-intl';
import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { audioManager } from '@/lib/audioManager';
import { supabase } from '@/lib/supabase';

type TierType = 'standard' | 'onyx' | 'human';

const TIER_STYLES: Record<TierType, { color: string; waveColor: string; glowColor: string; featured?: boolean }> = {
  standard: { color: 'from-gray-500 to-gray-600', waveColor: '#9CA3AF', glowColor: 'rgba(156, 163, 175, 0.3)' },
  onyx: { color: 'from-slate-400 via-slate-300 to-slate-500', waveColor: '#E5E7EB', glowColor: 'rgba(203, 213, 225, 0.5)', featured: true },
  human: { color: 'from-blue-500 to-blue-600', waveColor: '#3B82F6', glowColor: 'rgba(59, 130, 246, 0.3)' },
};

export default function VoiceTierComparison() {
  const t = useTranslations('home.tierComparison');
  const DEFAULT_TIERS = [
    { id: 'standard' as TierType, name: t('tierStandardName'), subtitle: t('tierStandardSubtitle'), audioSrc: '', description: t('tierStandardDescription') },
    { id: 'onyx' as TierType, name: t('tierOnyxName'), subtitle: t('tierOnyxSubtitle'), audioSrc: '', description: t('tierOnyxDescription') },
    { id: 'human' as TierType, name: t('tierHumanName'), subtitle: t('tierHumanSubtitle'), audioSrc: '', description: t('tierHumanDescription') },
  ];
  const [playingTier, setPlayingTier] = useState<TierType | null>(null);
  const [loadingTier, setLoadingTier] = useState<TierType | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioInstancesRef = useRef<Map<TierType, HTMLAudioElement>>(new Map());
  const router = useRouter();
  const [tiers, setTiers] = useState(DEFAULT_TIERS);

  useEffect(() => {
    supabase
      .from('audio_showcases')
      .select('*')
      .eq('section', 'voice_tier')
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          const slotMap: Record<string, string> = {};
          data.forEach((row) => {
            if (row.audio_url) slotMap[row.slot_key] = row.audio_url;
          });
          setTiers((prev) =>
            prev.map((t) => ({
              ...t,
              audioSrc: slotMap[t.id] || t.audioSrc,
            }))
          );
        }
      });
  }, []);

  useEffect(() => {
    return () => {
      audioInstancesRef.current.forEach((audio) => {
        audio.pause();
        audioManager.stop(audio);
        audio.src = '';
      });
      audioInstancesRef.current.clear();
    };
  }, []);

  const handlePlayPause = async (tierId: TierType) => {
    const tier = tiers.find((t) => t.id === tierId);
    if (!tier) return;

    let audio = audioInstancesRef.current.get(tierId);

    if (audio && playingTier === tierId && !audio.paused) {
      audio.pause();
      audio.currentTime = 0;
      audioManager.stop(audio);
      setPlayingTier(null);
      setLoadingTier(null);
      return;
    }

    audioInstancesRef.current.forEach((otherAudio, otherId) => {
      if (otherId !== tierId) {
        otherAudio.pause();
        otherAudio.currentTime = 0;
      }
    });

    setLoadingTier(tierId);
    setAudioError(null);

    try {
      if (!audio) {
        audio = new Audio();
        audio.preload = 'none';
        audio.addEventListener('ended', () => {
          setPlayingTier(null);
          setLoadingTier(null);
        });
        audio.addEventListener('error', () => {
          const code = audio!.error?.code;
          const msg = audio!.error?.message || 'Unknown error';
          console.error(`Audio error for ${tier.id}: code=${code}, message=${msg}`);
          setAudioError(t('audioErrorLoad', { tierName: tier.name }));
          setLoadingTier(null);
        });
        audioInstancesRef.current.set(tierId, audio);
      }

      audio.src = tier.audioSrc;
      audio.currentTime = 0;
      audio.volume = 1.0;

      audioManager.play(audio, () => {
        setPlayingTier(null);
        setLoadingTier(null);
      });

      const playPromise = audio.play();

      if (playPromise !== undefined) {
        await playPromise;
        setPlayingTier(tierId);
        setLoadingTier(null);
      }
    } catch (error) {
      console.error(`Failed to play ${tierId}:`, error);
      setAudioError(t('audioErrorPlay'));
      setLoadingTier(null);
      setPlayingTier(null);
      if (audio) audioManager.stop(audio);
    }
  };

  return (
    <section id="pricing" className="relative py-24 bg-gradient-to-b from-black via-gray-950 to-black overflow-hidden scroll-mt-24">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/20 via-transparent to-transparent"></div>

      <div className="max-w-7xl mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {t('sectionTitlePrefix')} <span className="bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300 bg-clip-text text-transparent">{t('sectionTitleHighlight')}</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            {t('sectionSubtitle')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-5xl mx-auto mb-8 p-6 rounded-xl bg-gradient-to-br from-gray-900/50 to-gray-800/30 border border-gray-700/50 backdrop-blur-sm"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-slate-500/10 border border-slate-500/20">
              <Sparkles className="w-5 h-5 text-slate-300" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-slate-300 mb-2">{t('sampleScriptLabel')}</h3>
              <p className="text-gray-300 leading-relaxed italic">
                "{t('sampleScript')}"
              </p>
            </div>
          </div>
        </motion.div>

        {audioError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-5xl mx-auto mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center"
          >
            {audioError}
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {tiers.map((tier, index) => {
            const style = TIER_STYLES[tier.id];
            return (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 * index }}
              className="relative group"
            >
              <div className={`relative p-6 rounded-2xl backdrop-blur-xl border transition-all duration-300 ${
                style.featured
                  ? 'bg-gradient-to-br from-slate-900/80 via-slate-800/80 to-slate-900/80 border-slate-400/50 shadow-2xl shadow-slate-500/20'
                  : 'bg-gradient-to-br from-gray-900/60 to-gray-800/40 border-gray-700/50 hover:border-gray-600/50'
              }`}>
                {style.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-slate-400 to-slate-300 text-gray-900 text-xs font-bold">
                    {t('mostPopularBadge')}
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className={`text-2xl font-bold mb-1 bg-gradient-to-r ${style.color} bg-clip-text text-transparent`}>
                    {tier.name}
                  </h3>
                  <p className="text-sm text-gray-400">{tier.subtitle}</p>
                </div>

                <div className="relative h-32 mb-6 flex items-center justify-center bg-black/40 rounded-lg overflow-hidden border border-gray-700/30">
                  {loadingTier === tier.id ? (
                    <div className="text-gray-400 text-sm font-medium">{t('bufferingText')}</div>
                  ) : playingTier === tier.id ? (
                    <div className="flex items-center justify-center gap-1 h-full w-full px-4">
                      {[...Array(24)].map((_, i) => {
                        const seed = (i * 7 + 13) % 24;
                        const h1 = 20 + (seed / 24) * 60;
                        const h2 = 30 + ((seed + 5) % 24 / 24) * 50;
                        const h3 = 20 + ((seed + 11) % 24 / 24) * 60;
                        const dur = 0.5 + (seed / 24) * 0.3;
                        return (
                          <motion.div
                            key={i}
                            className="w-1 rounded-full"
                            style={{
                              backgroundColor: style.waveColor,
                              boxShadow: `0 0 10px ${style.glowColor}`
                            }}
                            animate={{
                              height: [`${h1}%`, `${h2}%`, `${h3}%`],
                            }}
                            transition={{
                              duration: dur,
                              repeat: Infinity,
                              ease: "easeInOut",
                              delay: i * 0.05
                            }}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1 h-full w-full px-4">
                      {[...Array(24)].map((_, i) => {
                        const h = 20 + ((i * 7 + 3) % 24 / 24) * 30;
                        return (
                          <div
                            key={i}
                            className="w-1 rounded-full bg-gray-700"
                            style={{ height: `${Math.round(h * 100) / 100}%` }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handlePlayPause(tier.id)}
                  disabled={loadingTier === tier.id || !tier.audioSrc}
                  className={`w-full py-4 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                    style.featured
                      ? 'bg-gradient-to-r from-slate-500 to-slate-400 hover:from-slate-400 hover:to-slate-300 text-gray-900 shadow-lg shadow-slate-500/30 disabled:opacity-70'
                      : 'bg-gray-800/80 hover:bg-gray-700/80 text-gray-200 border border-gray-600/50 disabled:opacity-70'
                  }`}
                >
                  {loadingTier === tier.id ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-current border-t-transparent rounded-full"
                      />
                      {t('loadingText')}
                    </>
                  ) : playingTier === tier.id ? (
                    <>
                      <Pause className="w-5 h-5" />
                      {t('pauseButton')}
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      {t('listenNowButton')}
                    </>
                  )}
                </button>

                <p className="text-center text-sm text-gray-500 mt-3">{tier.description}</p>
              </div>

              {style.featured && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                  className="mt-4"
                >
                  <Button
                    onClick={() => router.push('/voices')}
                    size="lg"
                    className="w-full bg-gradient-to-r from-slate-600 to-slate-500 hover:from-slate-500 hover:to-slate-400 text-white font-semibold shadow-xl shadow-slate-500/20"
                  >
                    {t('experienceButton')}
                  </Button>
                </motion.div>
              )}
            </motion.div>
          );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="text-center mt-12"
        >
          <p className="text-gray-500 text-sm">
            {t('footerNote')}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
