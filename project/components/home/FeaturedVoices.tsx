'use client';

import { useTranslations } from 'next-intl';
import { Play, ArrowRight } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/use-scroll-animation';
import { useState, useRef, useEffect } from 'react';
import { Link } from '@/i18n/navigation';
import { audioManager } from '@/lib/audioManager';
import { supabase, type AudioShowcase } from '@/lib/supabase';

const CARD_STYLES: { badge: string; gradientColors: [string, string] }[] = [
  { badge: '\u2728 ONYX EXCLUSIVE', gradientColors: ['#1e3a8a', '#7c3aed'] },
  { badge: '\u2728 ONYX EXCLUSIVE', gradientColors: ['#06b6d4', '#8b5cf6'] },
  { badge: '\u2728 ONYX EXCLUSIVE', gradientColors: ['#dc2626', '#f97316'] },
];

export default function FeaturedVoices() {
  const t = useTranslations('home.featuredVoices');
  const fallbackVoices = [
    { id: 'slot_1', name: t('voice1Name'), archetype: t('voice1Archetype'), tags: [t('voice1Tag1'), t('voice1Tag2'), t('voice1Tag3')], description: t('voice1Description'), audioPreviewUrl: '' },
    { id: 'slot_2', name: t('voice2Name'), archetype: t('voice2Archetype'), tags: [t('voice2Tag1'), t('voice2Tag2'), t('voice2Tag3')], description: t('voice2Description'), audioPreviewUrl: '' },
    { id: 'slot_3', name: t('voice3Name'), archetype: t('voice3Archetype'), tags: [t('voice3Tag1'), t('voice3Tag2'), t('voice3Tag3')], description: t('voice3Description'), audioPreviewUrl: '' },
  ];
  const { ref: titleRef, isVisible: titleVisible } = useScrollAnimation();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const [voices, setVoices] = useState(fallbackVoices);

  useEffect(() => {
    supabase
      .from('audio_showcases')
      .select('*')
      .eq('section', 'featured_voices')
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setVoices(
            data.map((s: AudioShowcase, i: number) => ({
              ...fallbackVoices[i],
              id: s.slot_key,
              name: s.label || fallbackVoices[i]?.name || '',
              audioPreviewUrl: s.audio_url || '',
            }))
          );
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePlayAudio = (voiceId: string, audioUrl: string) => {
    if (!audioUrl) return;
    if (playingId === voiceId) {
      const audio = audioRefs.current[voiceId];
      if (audio) {
        audio.pause();
        audioManager.stop(audio);
      }
      setPlayingId(null);
    } else {
      if (!audioRefs.current[voiceId]) {
        audioRefs.current[voiceId] = new Audio(audioUrl);
        audioRefs.current[voiceId].onended = () => {
          setPlayingId(null);
          audioManager.stop(audioRefs.current[voiceId]);
        };
      }

      const audio = audioRefs.current[voiceId];
      audio.src = audioUrl;
      audioManager.play(audio, () => setPlayingId(null));
      audio.play();
      setPlayingId(voiceId);
    }
  };

  return (
    <section id="voices" className="relative py-24 px-4 scroll-mt-24">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.03),transparent_50%)]" />

      <div className="relative z-10 max-w-7xl mx-auto">
        <div ref={titleRef} className={`text-center mb-14 fade-up-element ${titleVisible ? 'fade-up-visible' : ''}`}>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            {t('sectionTitle')}
          </h2>
          <p className="text-gray-400 text-lg">
            {t('sectionSubtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {voices.map((voice, i) => {
            const style = CARD_STYLES[i] || CARD_STYLES[0];
            return (
              <div
                key={voice.id}
                className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 backdrop-blur-xl hover:border-white/20 transition-all group"
              >
                <div className="absolute top-4 right-4 z-10 px-3 py-1 rounded-full text-xs font-semibold border bg-gradient-to-r from-yellow-600/20 to-amber-600/20 border-yellow-500/50 text-yellow-300">
                  {t('badgeExclusive')}
                </div>

                <div
                  className="relative h-48 overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${style.gradientColors[0]}, ${style.gradientColors[1]})`
                  }}
                >
                  <div className="absolute inset-0 opacity-30">
                    <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                      <path d="M0,100 Q100,50 200,100 T400,100" fill="none" stroke="white" strokeWidth="2" className="animate-pulse" />
                      <path d="M0,120 Q100,80 200,120 T400,120" fill="none" stroke="white" strokeWidth="1.5" className="animate-pulse" style={{ animationDelay: '0.5s' }} />
                      <path d="M0,80 Q100,40 200,80 T400,80" fill="none" stroke="white" strokeWidth="1" className="animate-pulse" style={{ animationDelay: '1s' }} />
                    </svg>
                  </div>

                  <button
                    onClick={() => handlePlayAudio(voice.id, voice.audioPreviewUrl)}
                    className="absolute inset-0 flex items-center justify-center group/play"
                    disabled={!voice.audioPreviewUrl}
                  >
                    <div className={`w-16 h-16 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-black/80 hover:scale-110 transition-all ${!voice.audioPreviewUrl ? 'opacity-50' : ''}`}>
                      <Play className={`w-6 h-6 text-white ml-1 ${playingId === voice.id ? 'animate-pulse' : ''}`} fill={playingId === voice.id ? 'currentColor' : 'none'} />
                    </div>
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">
                      {voice.name}
                    </h3>
                    <p className="text-sm text-gray-400 uppercase tracking-widest">
                      {voice.archetype}
                    </p>
                  </div>

                  {voice.tags && voice.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {voice.tags.map((tag) => (
                        <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-gray-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-gray-400 text-sm leading-relaxed">
                    {voice.description}
                  </p>

                  <Link
                    href="/voices"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all group/btn"
                  >
                    {t('exploreVoiceButton')}
                    <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
