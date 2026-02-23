'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2 } from 'lucide-react';

interface ABSliderProps {
  rawSrc: string;
  liveSrc: string;
}

export default function ABSlider({ rawSrc, liveSrc }: ABSliderProps) {
  const t = useTranslations('orchestra.landing');
  const [isPlaying, setIsPlaying] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeSource, setActiveSource] = useState<'raw' | 'live'>('raw');
  const [hasInteracted, setHasInteracted] = useState(false);

  const rawRef = useRef<HTMLAudioElement>(null);
  const liveRef = useRef<HTMLAudioElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const syncingRef = useRef(false);

  useEffect(() => {
    const raw = rawRef.current;
    const live = liveRef.current;
    if (!raw || !live) return;

    const onLoaded = () => {
      if (raw.duration) setDuration(raw.duration);
    };
    raw.addEventListener('loadedmetadata', onLoaded);
    return () => raw.removeEventListener('loadedmetadata', onLoaded);
  }, []);

  const updateTime = useCallback(() => {
    const audio = sliderPos >= 50 ? liveRef.current : rawRef.current;
    if (audio) setCurrentTime(audio.currentTime);
    rafRef.current = requestAnimationFrame(updateTime);
  }, [sliderPos]);

  useEffect(() => {
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(updateTime);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, updateTime]);

  const syncTime = (source: HTMLAudioElement, target: HTMLAudioElement) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    target.currentTime = source.currentTime;
    syncingRef.current = false;
  };

  const togglePlay = () => {
    const raw = rawRef.current;
    const live = liveRef.current;
    if (!raw || !live) return;

    if (!hasInteracted) setHasInteracted(true);

    if (isPlaying) {
      raw.pause();
      live.pause();
      setIsPlaying(false);
    } else {
      const primary = sliderPos >= 50 ? live : raw;
      const secondary = sliderPos >= 50 ? raw : live;
      syncTime(primary, secondary);

      const playBoth = async () => {
        try {
          await Promise.all([raw.play(), live.play()]);
          setIsPlaying(true);
        } catch {
          setIsPlaying(false);
        }
      };
      playBoth();
    }
  };

  useEffect(() => {
    const raw = rawRef.current;
    const live = liveRef.current;
    if (!raw || !live) return;

    const rawVol = sliderPos <= 50 ? 1 - (sliderPos / 50) * 0 : Math.max(0, 1 - ((sliderPos - 50) / 50));
    const liveVol = sliderPos >= 50 ? 1 : sliderPos / 50;

    if (sliderPos <= 50) {
      raw.volume = 1;
      live.volume = 0;
      setActiveSource('raw');
    } else {
      raw.volume = 0;
      live.volume = 1;
      setActiveSource('live');
    }
  }, [sliderPos]);

  const handleSliderMove = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    handleSliderMove(e.clientX);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    handleSliderMove(e.touches[0].clientX);
  };

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => handleSliderMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => handleSliderMove(e.touches[0].clientX);
    const onUp = () => setIsDragging(false);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [isDragging, handleSliderMove]);

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (rawRef.current) rawRef.current.currentTime = 0;
    if (liveRef.current) liveRef.current.currentTime = 0;
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="w-full max-w-3xl mx-auto select-none">
      <audio ref={rawRef} src={rawSrc} preload="metadata" onEnded={handleEnded} />
      <audio ref={liveRef} src={liveSrc} preload="metadata" onEnded={handleEnded} />

      <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-sm">
        {/* Background glow */}
        <div
          className="absolute inset-0 transition-all duration-700 pointer-events-none"
          style={{
            background:
              sliderPos >= 50
                ? `radial-gradient(ellipse at ${sliderPos}% 50%, rgba(16,185,129,0.08) 0%, transparent 70%)`
                : `radial-gradient(ellipse at ${sliderPos}% 50%, rgba(239,68,68,0.06) 0%, transparent 70%)`,
          }}
        />

        {/* Labels row */}
        <div className="relative z-10 flex items-stretch justify-between px-6 pt-6 pb-0 gap-4">
          <motion.div
            animate={{ opacity: activeSource === 'raw' ? 1 : 0.35 }}
            transition={{ duration: 0.3 }}
            className="flex-1"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-xs font-bold tracking-widest uppercase text-red-400">
                {t('abRawLabel')}
              </span>
            </div>
            <p className="text-sm text-gray-500 leading-snug">{t('abPlasticSound')}</p>
          </motion.div>

          <div className="flex items-center justify-center px-4">
            <span className="text-xs text-gray-600 font-semibold tracking-widest uppercase">{t('abVs')}</span>
          </div>

          <motion.div
            animate={{ opacity: activeSource === 'live' ? 1 : 0.35 }}
            transition={{ duration: 0.3 }}
            className="flex-1 text-right"
          >
            <div className="flex items-center gap-2 mb-1 justify-end">
              <span className="text-xs font-bold tracking-widest uppercase text-emerald-400">
                {t('abOnyxLiveStrings')}
              </span>
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <p className="text-sm text-gray-500 leading-snug">{t('abRealWoodBreath')}</p>
          </motion.div>
        </div>

        {/* Slider track */}
        <div className="relative z-10 px-6 pt-8 pb-4">
          <div
            ref={trackRef}
            className="relative h-16 rounded-2xl overflow-hidden cursor-ew-resize"
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          >
            {/* Left side — Raw */}
            <div
              className="absolute inset-0 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.05) 100%)',
                clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
              }}
            />
            {/* Right side — Live */}
            <div
              className="absolute inset-0 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%)',
                clipPath: `inset(0 0 0 ${sliderPos}%)`,
              }}
            />

            {/* Track base */}
            <div className="absolute inset-0 rounded-2xl border border-white/10" />

            {/* Waveform bars */}
            <div className="absolute inset-0 flex items-center px-3 gap-[2px]">
              {Array.from({ length: 80 }).map((_, i) => {
                const height = 20 + Math.sin(i * 0.8) * 12 + Math.sin(i * 0.3) * 10 + ((i * 7 + 3) % 11) * 0.73;
                const posPercent = (i / 80) * 100;
                const isLive = posPercent > sliderPos;
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-full transition-colors duration-200"
                    style={{
                      height: `${Math.min(height, 52)}px`,
                      backgroundColor: isLive
                        ? 'rgba(16,185,129,0.5)'
                        : 'rgba(239,68,68,0.4)',
                    }}
                  />
                );
              })}
            </div>

            {/* Divider handle */}
            <div
              className="absolute top-0 bottom-0 w-[3px] bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)] z-10 pointer-events-none"
              style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white shadow-lg flex items-center justify-center">
                <div className="flex gap-[3px]">
                  <div className="w-[2px] h-3 rounded-full bg-gray-400" />
                  <div className="w-[2px] h-3 rounded-full bg-gray-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Drag hint */}
          <AnimatePresence>
            {!hasInteracted && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.8 }}
                className="flex items-center justify-center gap-2 mt-3 text-xs text-gray-600"
              >
                <span>{t('abDragToCompare')}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="relative z-10 flex items-center gap-4 px-6 pb-6">
          {/* Play button */}
          <button
            onClick={togglePlay}
            className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95"
            style={{
              background:
                activeSource === 'live'
                  ? 'linear-gradient(135deg, #059669, #10b981)'
                  : 'linear-gradient(135deg, #dc2626, #ef4444)',
              boxShadow:
                activeSource === 'live'
                  ? '0 4px 20px rgba(16,185,129,0.35)'
                  : '0 4px 20px rgba(239,68,68,0.3)',
            }}
          >
            <AnimatePresence mode="wait">
              {isPlaying ? (
                <motion.div key="pause" initial={{ scale: 0.7 }} animate={{ scale: 1 }} exit={{ scale: 0.7 }}>
                  <Pause className="w-5 h-5 text-white" />
                </motion.div>
              ) : (
                <motion.div key="play" initial={{ scale: 0.7 }} animate={{ scale: 1 }} exit={{ scale: 0.7 }}>
                  <Play className="w-5 h-5 text-white ml-0.5" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>

          {/* Progress bar */}
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="relative h-1.5 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${progressPct}%`,
                  background:
                    activeSource === 'live'
                      ? 'linear-gradient(90deg, #059669, #34d399)'
                      : 'linear-gradient(90deg, #dc2626, #f87171)',
                }}
              />
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] text-gray-600 tabular-nums">{formatTime(currentTime)}</span>
              <span className="text-[10px] text-gray-600 tabular-nums">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Source indicator */}
          <div className="flex-shrink-0">
            <motion.div
              key={activeSource}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide"
              style={{
                background:
                  activeSource === 'live'
                    ? 'rgba(16,185,129,0.15)'
                    : 'rgba(239,68,68,0.12)',
                color: activeSource === 'live' ? '#34d399' : '#f87171',
                border: `1px solid ${activeSource === 'live' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.2)'}`,
              }}
            >
              <Volume2 className="w-3 h-3" />
              {activeSource === 'live' ? t('abLive') : t('abRaw')}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
