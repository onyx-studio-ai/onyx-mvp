'use client';

/*
  聲音波形視覺(裝飾用)— 卡片上「這是聲音」的識別,取代 Spotify 的封面圖。
  真人=橘色漸層、AI=藍色漸層(Wing 2026-07-14 定,見 feedback_play_button_style)。
  playing 時律動。非真實頻譜,只是穩定的裝飾波形(依 seed 產生,同一張卡每次一樣)。
  keyframe/class 用 <WaveStyle/> 在每頁掛一次即可(別每張卡重複)。
*/

const RAMP: Record<'human' | 'ai', [number[], number[]]> = {
  human: [[243, 192, 106], [198, 84, 20]],
  ai: [[150, 190, 255], [42, 80, 205]],
};

const lp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

export function WaveStyle() {
  return (
    <style>{`
      .onyx-bar{flex:1;border-radius:2px;opacity:.82}
      .onyx-wave.is-playing .onyx-bar{opacity:1;animation:onyx-eq 1s ease-in-out infinite}
      @keyframes onyx-eq{0%,100%{transform:scaleY(.55)}50%{transform:scaleY(1)}}
      @media (prefers-reduced-motion:reduce){.onyx-wave.is-playing .onyx-bar{animation:none}}
    `}</style>
  );
}

export function Waveform({
  variant = 'human',
  active = false,
  seed = 0,
  bars = 40,
}: {
  variant?: 'human' | 'ai';
  active?: boolean;
  seed?: number;
  bars?: number;
}) {
  const r = RAMP[variant];
  return (
    <div className={`onyx-wave flex-1 min-w-0 flex items-center gap-[2.5px] h-[42px] ${active ? 'is-playing' : ''}`} aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => {
        const t = i / (bars - 1);
        const col = `rgb(${lp(r[0][0], r[1][0], t)},${lp(r[0][1], r[1][1], t)},${lp(r[0][2], r[1][2], t)})`;
        const h = 18 + Math.abs(Math.sin(i * 1.7 + seed * 2.3)) * 78;
        return <span key={i} className="onyx-bar" style={{ height: `${h}%`, background: col, animationDelay: `${(i * 0.03).toFixed(2)}s` }} />;
      })}
    </div>
  );
}
