'use client';

/*
  SEO 著陸頁的配音員 demo 試聽列表(播放鍵規範:白圓深三角、放波形左邊、真人=橘波形,
  見 feedback_play_button_style)。每列一個隱藏 <audio>;全站單一播放由 root layout 的
  SingleAudioPlayback 保證。demo 禁下載/右鍵(比照 talent 公開頁)。
*/

import { useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { Waveform, WaveStyle } from '@/components/Waveform';

export type DemoStripItem = { talentId: string; name: string; demoName?: string; url: string; profileHref: string };

export default function DemoStrip({ items, viewProfile }: { items: DemoStripItem[]; viewProfile: string }) {
  const [playing, setPlaying] = useState<string | null>(null);
  const refs = useRef<Record<string, HTMLAudioElement | null>>({});

  const toggle = (id: string) => {
    const el = refs.current[id];
    if (!el) return;
    if (playing === id && !el.paused) { el.pause(); setPlaying(null); return; }
    el.play().catch(() => {});
    setPlaying(id);
  };

  return (
    <div className="space-y-2.5">
      <WaveStyle />
      {items.map((d) => (
        <div key={d.talentId} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
          <button type="button" onClick={() => toggle(d.talentId)}
            aria-label={playing === d.talentId ? 'Pause' : 'Play'}
            className="w-9 h-9 rounded-full bg-white flex items-center justify-center shrink-0 hover:scale-105 transition-transform">
            {playing === d.talentId
              ? <Pause className="w-4 h-4 text-gray-900" fill="currentColor" />
              : <Play className="w-4 h-4 text-gray-900 translate-x-[1px]" fill="currentColor" />}
          </button>
          <div className="h-8 flex-1 min-w-0">
            <Waveform variant="human" active={playing === d.talentId} seed={d.talentId.length + d.name.length} />
          </div>
          <div className="min-w-0 w-40 sm:w-56 text-right">
            <p className="text-sm text-gray-200 font-medium truncate">{d.name}</p>
            {d.demoName ? <p className="text-xs text-gray-400 truncate">{d.demoName}</p> : null}
          </div>
          <a href={d.profileHref} className="text-xs text-gray-400 hover:text-white shrink-0 underline underline-offset-2">{viewProfile}</a>
          <audio ref={(el) => { refs.current[d.talentId] = el; }} src={d.url} preload="none"
            onEnded={() => setPlaying((p) => (p === d.talentId ? null : p))}
            onPause={() => setPlaying((p) => (p === d.talentId ? null : p))}
            onContextMenu={(e) => e.preventDefault()} controlsList="nodownload" className="hidden" />
        </div>
      ))}
    </div>
  );
}
