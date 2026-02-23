'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { audioManager } from '@/lib/audioManager';

interface CatalogAudioPlayerProps {
  audioUrl: string;
  onPlay?: () => void;
}

export default function CatalogAudioPlayer({ audioUrl, onPlay }: CatalogAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      setIsPlaying(false);
      audioManager.stop(audio);
    };

    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      audioManager.stop(audio);
    };
  }, []);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      audioManager.stop(audio);
    } else {
      audioManager.play(audio, () => setIsPlaying(false));
      onPlay?.();
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('Error playing audio:', error);
        audioManager.stop(audio);
      }
    }
  };

  return (
    <div className="inline-block">
      <audio ref={audioRef} src={audioUrl} />
      <button
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
        className="w-14 h-14 rounded-full bg-cyan-500/90 backdrop-blur-sm border-2 border-white/20 flex items-center justify-center shadow-[0_8px_32px_rgba(0,217,255,0.4)] transition-all duration-300 hover:scale-110 hover:shadow-[0_12px_48px_rgba(0,217,255,0.6)] hover:bg-cyan-500 active:scale-95 text-black"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
      </button>
    </div>
  );
}
