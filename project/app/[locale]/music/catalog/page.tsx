'use client';

/**
 * /music/catalog — browse-and-preview music library.
 *
 * Sources rows from audio_showcases.section='music_library' (same pattern
 * used by featured_voices). Two top-level views:
 *  - Instrumental (background beds for voiceover, podcast, video)
 *  - Vocal POP (full songs with lyrics, EN/CN per category)
 *
 * Each row carries audio_url (40-sec preview, fade-out), label/subtitle,
 * BPM in description. License CTA jumps to the /music funnel.
 *
 * Previously this route was a redirect to /music — restored when the
 * music library was actually populated (39 Suno-generated tracks).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Play, Pause, ArrowRight, Music, Mic2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { audioManager } from '@/lib/audioManager';
import Footer from '@/components/landing/Footer';

type Row = {
  id: string;
  slot_key: string;
  audio_url: string;
  label: string;        // English title
  subtitle: string;     // category English (Brand Sting / Pop Ballad / ...)
  description: string;  // 'BPM 120 · instrumental · instrumental'
  tags: string[];       // [category, bpm, type, lang]
  sort_order: number;
};

// Per-slot zh title + category, kept in code (not DB) so copy tweaks don't
// need a migration. Falls back to row.label / row.subtitle when missing.
const ZH_LABEL: Record<string, { title: string; cat: string }> = {
  'brand-sting-1':     { title: '品牌 Sting — 短打',     cat: '廣告 / 品牌' },
  'brand-sting-2':     { title: '品牌 Sting — 科技感',   cat: '廣告 / 品牌' },
  'brand-sting-3':     { title: '品牌 Sting — 質感',     cat: '廣告 / 品牌' },
  'trailer-1':         { title: '預告 — 史詩管弦',       cat: '電影預告' },
  'trailer-2':         { title: '預告 — 黑暗混合',       cat: '電影預告' },
  'trailer-3':         { title: '預告 — 英雄感',         cat: '電影預告' },
  'podcast-bed-1':     { title: 'Podcast 背景 — 慵懶',   cat: 'Podcast 背景' },
  'podcast-bed-2':     { title: 'Podcast 背景 — 爵士',   cat: 'Podcast 背景' },
  'podcast-bed-3':     { title: 'Podcast 背景 — 木吉他', cat: 'Podcast 背景' },
  'corporate-1':       { title: '企業 — 激勵',           cat: '企業 / 簡報' },
  'corporate-2':       { title: '企業 — 科技',           cat: '企業 / 簡報' },
  'corporate-3':       { title: '企業 — 年報',           cat: '企業 / 簡報' },
  'game-1':            { title: '遊戲 — RPG 戰鬥',       cat: '遊戲' },
  'game-2':            { title: '遊戲 — 黑暗氛圍',       cat: '遊戲' },
  'game-3':            { title: '遊戲 — 復古 8-bit',     cat: '遊戲' },
  'wellness-1':        { title: 'Spa — 冥想',            cat: 'Spa / 冥想' },
  'wellness-2':        { title: 'Spa — 禪意',            cat: 'Spa / 冥想' },
  'wedding-1':         { title: '婚禮 — 浪漫',           cat: '婚禮 / 紀念' },
  'wedding-2':         { title: '紀念 — 懷舊',           cat: '婚禮 / 紀念' },
  'kids-1':            { title: '兒童 — 烏克麗麗',       cat: '兒童 / 動畫' },
  'kids-2':            { title: '兒童 — 卡通冒險',       cat: '兒童 / 動畫' },
  'travel-1':          { title: '旅遊 — 陽光 Vlog',      cat: '旅遊 / 美食' },
  'travel-2':          { title: '美食 — 溫暖 Lo-Fi',     cat: '旅遊 / 美食' },
  'seasonal-1':        { title: '節慶 — 新春',           cat: '節慶 / 賀年' },
  'seasonal-2':        { title: '節慶 — 聖誕',           cat: '節慶 / 賀年' },
  'pop-ballad-en':     { title: '流行抒情 (英) — Silence Speaks Too Loud', cat: '流行抒情' },
  'pop-ballad-cn':     { title: '流行抒情 (中) — 夜深以後',                 cat: '流行抒情' },
  'pop-upbeat-en':     { title: '輕快流行 (英) — Tonight We Stay',          cat: '輕快流行' },
  'pop-upbeat-cn':     { title: '輕快流行 (中) — 今夜街口',                 cat: '輕快流行' },
  'rnb-smooth-en':     { title: 'R&B (英) — Slow It Down',                  cat: 'R&B' },
  'rnb-smooth-cn':     { title: 'R&B (中) — 慢一點走',                      cat: 'R&B' },
  'hiphop-trap-en':    { title: '嘻哈 (英) — One Brick One Line',           cat: '嘻哈' },
  'hiphop-trap-cn':    { title: '嘻哈 (中) — 從零起跑',                     cat: '嘻哈' },
  'indie-bedroom-en':  { title: '獨立 (英) — Floorboard Afternoon',         cat: '獨立流行' },
  'indie-bedroom-cn':  { title: '獨立 (中) — 午後地板光',                   cat: '獨立流行' },
  'kpop-idol-en':      { title: 'K-Pop (英) — Wave Call',                   cat: 'K-Pop' },
  'kpop-idol-cn':      { title: 'K-Pop (中) — 浪起飛翔',                    cat: 'K-Pop' },
  'latin-reggaeton-en':{ title: '拉丁 (英/西) — Marea Alta',                cat: '拉丁' },
  'latin-fusion-cn':   { title: '拉丁融合 (中) — 海風上心',                 cat: '拉丁' },
};

export default function MusicCatalogPage() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const [rows, setRows] = useState<Row[]>([]);
  const [view, setView] = useState<'instrumental' | 'vocal'>('instrumental');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  useEffect(() => {
    supabase
      .from('audio_showcases')
      .select('*')
      .eq('section', 'music_library')
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (Array.isArray(data)) setRows(data as Row[]);
      });
  }, []);

  // Filter to selected view ('instrumental' or 'vocal') then group by
  // category for sectioned display.
  const grouped = useMemo(() => {
    const filtered = rows.filter(r => Array.isArray(r.tags) && r.tags.includes(view));
    const byCat: Record<string, Row[]> = {};
    for (const r of filtered) {
      const zh = ZH_LABEL[r.slot_key]?.cat;
      const cat = isZh && zh ? zh : r.subtitle;
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(r);
    }
    return byCat;
  }, [rows, view, isZh]);

  const togglePlay = (row: Row) => {
    if (playingId === row.id) {
      audioRefs.current[row.id]?.pause();
      audioManager.stop(audioRefs.current[row.id]);
      setPlayingId(null);
      return;
    }
    if (!audioRefs.current[row.id]) {
      audioRefs.current[row.id] = new Audio(row.audio_url);
      audioRefs.current[row.id].onended = () => {
        setPlayingId(null);
        audioManager.stop(audioRefs.current[row.id]);
      };
    }
    const a = audioRefs.current[row.id];
    audioManager.play(a, () => setPlayingId(null));
    a.play();
    setPlayingId(row.id);
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="pt-32 pb-12 px-4 text-center relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(168,85,247,0.08),transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            {isZh ? '音樂庫' : 'Music Library'}
          </h1>
          <p className="text-gray-400 text-lg">
            {isZh
              ? '挑一首作為起點 — 我們會以你選的方向客製化最終曲目。'
              : 'Pick a starting point — we customize the final track in the direction you choose.'}
          </p>
        </div>
      </section>

      <section className="px-4">
        <div className="max-w-6xl mx-auto flex gap-2 justify-center mb-10">
          <button
            onClick={() => setView('instrumental')}
            className={`flex items-center gap-2 px-6 py-3 rounded-full border transition ${
              view === 'instrumental'
                ? 'bg-white text-black border-white'
                : 'bg-white/5 text-white border-white/10 hover:border-white/30'
            }`}
          >
            <Music className="w-4 h-4" />
            {isZh ? '配音底音' : 'Instrumental Bed'}
          </button>
          <button
            onClick={() => setView('vocal')}
            className={`flex items-center gap-2 px-6 py-3 rounded-full border transition ${
              view === 'vocal'
                ? 'bg-white text-black border-white'
                : 'bg-white/5 text-white border-white/10 hover:border-white/30'
            }`}
          >
            <Mic2 className="w-4 h-4" />
            {isZh ? 'POP 帶人聲' : 'Vocal POP'}
          </button>
        </div>
      </section>

      <section className="px-4 pb-24">
        <div className="max-w-6xl mx-auto space-y-12">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <h2 className="text-2xl font-bold mb-4 text-white border-l-4 border-amber-500/60 pl-3">{cat}</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map(row => {
                  const zh = ZH_LABEL[row.slot_key];
                  const title = isZh && zh ? zh.title : row.label;
                  const bpm = row.tags?.[1];
                  const playing = playingId === row.id;
                  return (
                    <div
                      key={row.id}
                      className="p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition group"
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => togglePlay(row)}
                          className="w-11 h-11 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 flex-shrink-0 flex items-center justify-center transition"
                          aria-label={playing ? 'Pause' : 'Play'}
                        >
                          {playing
                            ? <Pause className="w-4 h-4 text-amber-300" />
                            : <Play className="w-4 h-4 text-amber-300 ml-0.5" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white truncate">{title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            BPM {bpm} · {isZh ? '40 秒預覽' : '40s preview'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <p className="text-center text-gray-500 py-20">
              {isZh ? '正在載入...' : 'Loading...'}
            </p>
          )}
        </div>
      </section>

      <section className="px-4 pb-24">
        <div className="max-w-3xl mx-auto p-8 rounded-2xl bg-gradient-to-br from-amber-500/10 to-pink-500/10 border border-amber-500/20 text-center">
          <h3 className="text-2xl font-bold mb-2">
            {isZh ? '聽到喜歡的方向了嗎?' : 'Heard a direction you like?'}
          </h3>
          <p className="text-gray-400 mb-6">
            {isZh
              ? '告訴我們你挑的曲目編號 + 你的專案需求,我們會客製化最終版本。'
              : 'Tell us which track number you picked plus your project brief — we will customize the final.'}
          </p>
          <Link
            href="/music"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-amber-500 text-black font-semibold hover:bg-amber-400 transition"
          >
            {isZh ? '前往音樂工作室' : 'Go to Music Studio'}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
