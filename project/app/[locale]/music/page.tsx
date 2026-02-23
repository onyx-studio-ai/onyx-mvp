'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Music, Sparkles, Wand2, Headphones, Mic2, Play, Pause, ArrowRight, ChevronDown, Zap, Library, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Footer from '@/components/landing/Footer';
import { supabase } from '@/lib/supabase';
import { audioManager } from '@/lib/audioManager';

export default function MusicPage() {
  const t = useTranslations('music.landing');
  const [isPlayingA, setIsPlayingA] = useState(false);
  const [isPlayingB, setIsPlayingB] = useState(false);
  const [rawUrl, setRawUrl] = useState('');
  const [onyxUrl, setOnyxUrl] = useState('');
  const audioRefA = useRef<HTMLAudioElement | null>(null);
  const audioRefB = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    supabase
      .from('audio_showcases')
      .select('slot_key, audio_url')
      .eq('section', 'music_comparison')
      .then(({ data }) => {
        if (data) {
          data.forEach((row) => {
            if (row.audio_url) {
              if (row.slot_key === 'raw') setRawUrl(row.audio_url);
              if (row.slot_key === 'onyx') setOnyxUrl(row.audio_url);
            }
          });
        }
      });
    return () => {
      if (audioRefA.current) { audioRefA.current.pause(); audioManager.stop(audioRefA.current); }
      if (audioRefB.current) { audioRefB.current.pause(); audioManager.stop(audioRefB.current); }
    };
  }, []);

  const toggleA = () => {
    if (!rawUrl) return;
    if (!audioRefA.current) {
      audioRefA.current = new Audio(rawUrl);
      audioRefA.current.onended = () => setIsPlayingA(false);
    }
    if (isPlayingA) {
      audioRefA.current.pause();
      audioManager.stop(audioRefA.current);
      setIsPlayingA(false);
    } else {
      if (audioRefB.current && isPlayingB) { audioRefB.current.pause(); audioManager.stop(audioRefB.current); setIsPlayingB(false); }
      audioManager.play(audioRefA.current, () => setIsPlayingA(false));
      audioRefA.current.play();
      setIsPlayingA(true);
    }
  };

  const toggleB = () => {
    if (!onyxUrl) return;
    if (!audioRefB.current) {
      audioRefB.current = new Audio(onyxUrl);
      audioRefB.current.onended = () => setIsPlayingB(false);
    }
    if (isPlayingB) {
      audioRefB.current.pause();
      audioManager.stop(audioRefB.current);
      setIsPlayingB(false);
    } else {
      if (audioRefA.current && isPlayingA) { audioRefA.current.pause(); audioManager.stop(audioRefA.current); setIsPlayingA(false); }
      audioManager.play(audioRefB.current, () => setIsPlayingB(false));
      audioRefB.current.play();
      setIsPlayingB(true);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white overflow-x-hidden">
      {/* SECTION 1: CINEMATIC HERO */}
      <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 pt-20">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-[#050505] to-[#050505]" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/30 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-600/30 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-6xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
          >
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 backdrop-blur-sm">
                <Music className="w-12 h-12 text-purple-400" />
              </div>
            </div>

            <h1 className="text-6xl md:text-8xl font-bold mb-8 leading-tight">
              <span className="bg-gradient-to-r from-purple-200 via-pink-200 to-purple-400 bg-clip-text text-transparent">
                {t('heroLine1')}
              </span>
              <br />
              <span className="text-white/90">
                {t('heroLine2')}
              </span>
              <br />
              <span className="text-white/90">
                {t('heroLine3')}
              </span>
            </h1>

            <p className="text-2xl md:text-3xl text-gray-300 mb-12 max-w-4xl mx-auto leading-relaxed">
              {t('heroSubtitle')}
            </p>

            <div className="flex flex-col sm:flex-row gap-6 items-center justify-center">
              <Link href="/music/catalog">
                <Button className="group h-16 px-10 text-lg font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-all duration-300">
                  <Library className="mr-2 w-5 h-5" />
                  {t('browseCatalog')}
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>

              <Link href="/music/pricing">
                <Button className="group h-16 px-10 text-lg font-semibold bg-white/10 hover:bg-white/20 border border-white/20 transition-all duration-300">
                  <Zap className="mr-2 w-5 h-5" />
                  {t('viewPricing')}
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>

            <div className="mt-16">
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex justify-center"
              >
                <ChevronDown className="w-8 h-8 text-purple-400/50" />
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 2: THE HYBRID PROCESS */}
      <section className="relative py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
              {t('hybridProcessTitle')}
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              {t('hybridProcessSubtitle')}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: t('step01Title'),
                description: t('step01Desc'),
                icon: <Wand2 className="w-8 h-8" />,
                gradient: 'from-purple-600 to-purple-400',
              },
              {
                step: '02',
                title: t('step02Title'),
                description: t('step02Desc'),
                icon: <Sparkles className="w-8 h-8" />,
                gradient: 'from-pink-600 to-pink-400',
              },
              {
                step: '03',
                title: t('step03Title'),
                description: t('step03Desc'),
                icon: <Mic2 className="w-8 h-8" />,
                gradient: 'from-purple-400 to-pink-400',
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                viewport={{ once: true }}
                className="relative group"
              >
                <div className="relative p-10 rounded-3xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm hover:border-purple-500/50 transition-all duration-500">
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-5 rounded-3xl transition-opacity duration-500`}
                  />

                  <div className="relative">
                    <div className="text-7xl font-bold text-white/5 mb-4">{item.step}</div>

                    <div
                      className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${item.gradient} mb-6 transform group-hover:scale-110 transition-transform duration-300`}
                    >
                      {item.icon}
                    </div>

                    <h3 className="text-3xl font-bold mb-4 text-white">{item.title}</h3>
                    <p className="text-gray-400 leading-relaxed text-lg">{item.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3: HEAR THE DIFFERENCE */}
      <section className="relative py-32 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-purple-900/5 to-transparent">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
              {t('hearDifferenceTitle')}
            </h2>
            <p className="text-xl text-gray-400 mb-3">
              {t('hearDifferenceSubtitle')}
            </p>
            <p className="text-lg text-gray-500">
              {t('hearDifferenceCompare')}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="relative p-10 rounded-3xl bg-gradient-to-br from-red-600/10 to-red-900/10 border border-red-500/20 backdrop-blur-sm"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30">
                  <Headphones className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">{t('rawAiTitle')}</h3>
                  <p className="text-sm text-gray-400">{t('rawAiBefore')}</p>
                </div>
              </div>

              <button
                onClick={toggleA}
                disabled={!rawUrl}
                className="w-full h-20 rounded-2xl bg-black/40 border border-red-500/30 hover:bg-red-500/10 transition-all duration-300 flex items-center justify-center gap-4 group disabled:opacity-50"
              >
                {isPlayingA ? (
                  <Pause className="w-8 h-8 text-red-400 group-hover:scale-110 transition-transform" />
                ) : (
                  <Play className="w-8 h-8 text-red-400 group-hover:scale-110 transition-transform" />
                )}
                <span className="text-lg font-semibold text-gray-300">
                  {isPlayingA ? t('playing') : t('listen')}
                </span>
              </button>

              <div className="mt-6 space-y-2 text-sm text-gray-500">
                <p>• {t('rawBullet1')}</p>
                <p>• {t('rawBullet2')}</p>
                <p>• {t('rawBullet3')}</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="relative p-10 rounded-3xl bg-gradient-to-br from-purple-600/10 to-pink-600/10 border border-purple-500/30 backdrop-blur-sm"
            >
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 blur-xl" />

              <div className="relative">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600">
                    <Music className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">{t('onyxFinishTitle')}</h3>
                    <p className="text-sm text-purple-300">{t('onyxFinishAfter')}</p>
                  </div>
                </div>

                <button
                  onClick={toggleB}
                  disabled={!onyxUrl}
                  className="w-full h-20 rounded-2xl bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/50 hover:from-purple-600/30 hover:to-pink-600/30 transition-all duration-300 flex items-center justify-center gap-4 group disabled:opacity-50"
                >
                  {isPlayingB ? (
                    <Pause className="w-8 h-8 text-purple-400 group-hover:scale-110 transition-transform" />
                  ) : (
                    <Play className="w-8 h-8 text-purple-400 group-hover:scale-110 transition-transform" />
                  )}
                  <span className="text-lg font-semibold text-white">
                    {isPlayingB ? t('playing') : t('listen')}
                  </span>
                </button>

                <div className="mt-6 space-y-2 text-sm text-purple-300">
                  <p>• {t('onyxBullet1')}</p>
                  <p>• {t('onyxBullet2')}</p>
                  <p>• {t('onyxBullet3')}</p>
                </div>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            viewport={{ once: true }}
            className="text-center mt-16"
          >
            <p className="text-gray-500 mb-6">
              {t('readyMoreStyles')}
            </p>
            <Link href="/music/catalog">
              <Button className="h-14 px-10 text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-all duration-300">
                <Library className="mr-2 w-5 h-5" />
                {t('exploreFullCatalog')}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* SECTION 4: LIVE STRINGS FEATURE */}
      <section className="relative py-32 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-y-0 left-0 right-0 bg-gradient-to-b from-transparent via-amber-950/15 to-transparent" />
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left: text */}
            <motion.div
              initial={{ opacity: 0, x: -32 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold tracking-[0.15em] uppercase mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                {t('flagshipService')}
              </div>

              <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-6">
                {t('liveStringsHeadline1')}
                <br />
                AI{' '}
                <span className="line-through text-gray-600">{t('liveStringsHeadlineCan')}</span>
                <span className="text-gray-400"> {t('liveStringsHeadlineCannot')}</span>
                <br />
                <span className="bg-gradient-to-r from-amber-400 via-orange-300 to-yellow-400 bg-clip-text text-transparent">
                  {t('liveStringsHeadlineReplace')}
                </span>
              </h2>

              <p className="text-lg text-gray-400 leading-relaxed mb-6">
                {t.rich('liveStringsDesc', {
                  highlight: (chunks) => <span className="text-amber-400 font-semibold">{chunks}</span>,
                })}
              </p>

              <ul className="space-y-3 mb-10">
                {[
                  t('liveStringsBullet1'),
                  t('liveStringsBullet2'),
                  t('liveStringsBullet3'),
                  t('liveStringsBullet4'),
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-gray-300">
                    <span className="mt-1.5 flex-shrink-0 w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>

              <Link href="/music/orchestra">
                <Button className="h-14 px-8 text-base font-semibold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 transition-all duration-300 shadow-xl shadow-amber-600/25">
                  {t('exploreLiveStrings')}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </motion.div>

            {/* Right: visual card */}
            <motion.div
              initial={{ opacity: 0, x: 32 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.15 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="relative rounded-3xl overflow-hidden border border-amber-500/20 bg-gradient-to-br from-amber-950/30 via-stone-950/40 to-orange-950/20 p-10">
                {/* Glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/8 rounded-full blur-[80px] pointer-events-none" />

                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-600 to-orange-600 shadow-lg shadow-amber-600/30">
                      <Music2 className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-amber-400 font-semibold tracking-widest uppercase mb-1">
                        {t('onyxStringsLabel')}
                      </p>
                      <h3 className="text-2xl font-bold text-white">{t('liveStringRecording')}</h3>
                    </div>
                  </div>

                  {/* Fake A/B comparison teaser */}
                  <div className="space-y-3 mb-8">
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-red-950/30 border border-red-500/15">
                      <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-1">{t('rawMidiLabel')}</p>
                        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full w-3/4 rounded-full bg-red-400/40" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(239,68,68,0.3) 3px, rgba(239,68,68,0.3) 6px)' }} />
                        </div>
                      </div>
                      <span className="text-xs text-gray-600 font-mono">{t('rawMidiTag')}</span>
                    </div>

                    <div className="flex items-center justify-center py-1">
                      <ArrowRight className="w-4 h-4 text-amber-500 rotate-90" />
                    </div>

                    <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-950/30 border border-amber-500/25 shadow-lg shadow-amber-500/10">
                      <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 animate-pulse" />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">{t('onyxLiveSessionLabel')}</p>
                        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: '88%', background: 'linear-gradient(90deg, #d97706, #f59e0b, #fcd34d, #f59e0b, #d97706)', backgroundSize: '200% 100%' }} />
                        </div>
                      </div>
                      <span className="text-xs text-amber-500 font-mono font-semibold">{t('onyxLiveSessionTag')}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/5">
                    {[
                      { label: t('statFlatRateLabel'), value: t('statFlatRateValue') },
                      { label: t('statDeliveryLabel'), value: t('statDeliveryValue') },
                      { label: t('statRevisionsLabel'), value: t('statRevisionsValue') },
                    ].map((stat) => (
                      <div key={stat.label} className="text-center">
                        <p className="text-lg font-bold text-white">{stat.value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* SECTION 5: CTA */}
      <section className="relative py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="relative p-16 rounded-3xl bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 backdrop-blur-sm overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-pink-600/20 blur-3xl" />

            <div className="relative text-center">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
                {t('ctaTitle')}
              </h2>
              <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
                {t('ctaSubtitle')}
              </p>

              <div className="flex flex-col sm:flex-row gap-6 items-center justify-center">
                <Link href="/music/catalog">
                  <Button className="h-16 px-10 text-lg font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-all duration-300">
                    <Library className="mr-2 w-5 h-5" />
                    {t('browseStyles')}
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>

                <Link href="/music/pricing">
                  <Button className="h-16 px-10 text-lg font-semibold bg-white/10 hover:bg-white/20 border border-white/20 transition-all duration-300">
                    <Zap className="mr-2 w-5 h-5" />
                    {t('viewAllTiers')}
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>

                <Link href="/music/orchestra">
                  <Button className="h-16 px-10 text-lg font-semibold bg-gradient-to-r from-amber-600/80 to-orange-600/80 hover:from-amber-600 hover:to-orange-600 border border-amber-500/30 transition-all duration-300">
                    <Music2 className="mr-2 w-5 h-5" />
                    {t('liveStringsBtn')}
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
              </div>

              <p className="text-xs text-gray-600 mt-8 max-w-2xl mx-auto text-center">
                {t('licensingDisclaimer')}
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
