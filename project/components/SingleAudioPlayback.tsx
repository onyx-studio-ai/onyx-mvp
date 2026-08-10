'use client';

/*
  全站「單一播放」守則(Wing 2026-08-10:參考音兩個播放器可同時播,很怪)。
  任何 <audio>/<video> 開始播放時,自動暫停頁面上其他正在播的媒體。
  掛在根 layout 一次生效 —— 案件參考音、demo 清單、後台試聽全部適用。
  用 capture 階段監聽 document 的 play 事件(play 事件不冒泡,capture 才收得到)。
*/

import { useEffect } from 'react';

export default function SingleAudioPlayback() {
  useEffect(() => {
    const onPlay = (e: Event) => {
      const target = e.target;
      if (!(target instanceof HTMLMediaElement)) return;
      document.querySelectorAll<HTMLMediaElement>('audio, video').forEach((el) => {
        if (el !== target && !el.paused) el.pause();
      });
    };
    document.addEventListener('play', onPlay, true);
    return () => document.removeEventListener('play', onPlay, true);
  }, []);
  return null;
}
