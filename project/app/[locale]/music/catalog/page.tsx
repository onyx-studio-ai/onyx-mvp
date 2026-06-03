'use client';

/**
 * /music/catalog — browse-and-preview music library.
 *
 * Sources rows from audio_showcases.section='music_library' (same pattern
 * used by featured_voices). Two top-level views:
 *  - Instrumental (background beds for voiceover, podcast, video)
 *  - Vocal POP (full songs with lyrics, EN/CN per category)
 *
 * Each track card has a gradient cover + Lucide icon styled to its mood,
 * title, BPM, and a 1-line "what this sounds like" blurb.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  Play, Pause, ArrowRight, Music, Mic2,
  Zap, Film, Mic, Briefcase, Gamepad2, Leaf, Heart, Sparkles, Plane, Gift,
  Piano, Star, Moon, Cloud, Sun,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { audioManager } from '@/lib/audioManager';
import Footer from '@/components/landing/Footer';

type Row = {
  id: string;
  slot_key: string;
  audio_url: string;
  label: string;
  subtitle: string;
  description: string;
  tags: string[];
  sort_order: number;
};

type TrackMeta = {
  zhTitle: string;
  zhCat: string;
  zhDesc: string;
  enDesc: string;
  icon: LucideIcon;
  gradient: string; // tailwind from-X to-Y classes
};

// Per-slot metadata. Kept in-file so designers can iterate without DB
// migrations. Description fields are 1-line "what this sounds like" blurbs
// that complement the technical BPM/length info.
const META: Record<string, TrackMeta> = {
  // Brand Sting — amber/gold
  'brand-sting-1':  { zhTitle: '品牌 Sting — 短打',    zhCat: '廣告 / 品牌',   zhDesc: '簡短有力的廣告片頭,適合 5-10 秒品牌標識',                      enDesc: 'Short, punchy intro for 5-10s brand stings',                       icon: Zap,       gradient: 'from-amber-500 to-orange-600' },
  'brand-sting-2':  { zhTitle: '品牌 Sting — 科技感',  zhCat: '廣告 / 品牌',   zhDesc: '亮麗合成器穿插俐落鼓,科技公司產品開發發布',                    enDesc: 'Glossy synths + tight drums, tech product launches',                icon: Zap,       gradient: 'from-amber-500 to-orange-600' },
  'brand-sting-3':  { zhTitle: '品牌 Sting — 質感',    zhCat: '廣告 / 品牌',   zhDesc: '緩慢爵士品牌音效,適合高端品牌簡介開頭',                        enDesc: 'Slow jazz brand stinger for premium brand openers',                 icon: Zap,       gradient: 'from-amber-500 to-orange-600' },
  // Trailer — dark navy/purple
  'trailer-1':      { zhTitle: '預告 — 史詩管弦',     zhCat: '電影預告',     zhDesc: '史詩管弦樂逐層堆疊,銅管炸裂,電影級預告',                       enDesc: 'Epic orchestra stacked layers, brass hits, blockbuster style',      icon: Film,      gradient: 'from-indigo-700 to-purple-900' },
  'trailer-2':      { zhTitle: '預告 — 黑暗混合',     zhCat: '電影預告',     zhDesc: '黑暗電子混合,深沉低音脈衝,現代大片預告',                       enDesc: 'Dark hybrid electronic, deep bass pulse, modern blockbuster',       icon: Film,      gradient: 'from-indigo-700 to-purple-900' },
  'trailer-3':      { zhTitle: '預告 — 英雄感',       zhCat: '電影預告',     zhDesc: '英雄感弦樂飆升,合唱激昂,情感釋放型預告',                       enDesc: 'Heroic strings soar, choir swells, emotional payoff trailer',       icon: Film,      gradient: 'from-indigo-700 to-purple-900' },
  // Podcast Bed — sage/warm
  'podcast-bed-1':  { zhTitle: 'Podcast 背景 — 慵懶',  zhCat: 'Podcast 背景', zhDesc: '慵懶 lo-fi 嘻哈節拍,黑膠雜音,深夜對談背景',                    enDesc: 'Lazy lo-fi hip-hop, vinyl crackle, late-night conversation bed',    icon: Mic,       gradient: 'from-emerald-700 to-teal-800' },
  'podcast-bed-2':  { zhTitle: 'Podcast 背景 — 爵士',  zhCat: 'Podcast 背景', zhDesc: '流暢爵士,刷鼓+原音貝斯,適合深度訪談',                          enDesc: 'Smooth jazz, brushed drums + upright bass, deep interview bed',     icon: Mic,       gradient: 'from-emerald-700 to-teal-800' },
  'podcast-bed-3':  { zhTitle: 'Podcast 背景 — 木吉他',zhCat: 'Podcast 背景', zhDesc: '木吉他指彈+溫暖墊樂,輕柔 podcast 開場',                        enDesc: 'Fingerpicked acoustic + warm pads, gentle podcast intro',           icon: Mic,       gradient: 'from-emerald-700 to-teal-800' },
  // Corporate — blue/teal
  'corporate-1':    { zhTitle: '企業 — 激勵',         zhCat: '企業 / 簡報',  zhDesc: '激勵企業簡報,鋼琴+弦樂+漸進鼓點',                              enDesc: 'Uplifting corporate, piano + strings + building drums',             icon: Briefcase, gradient: 'from-blue-600 to-cyan-700' },
  'corporate-2':    { zhTitle: '企業 — 科技',         zhCat: '企業 / 簡報',  zhDesc: '科技公司形象,清亮合成器+穩定電子鼓',                            enDesc: 'Tech company brand, clean synths + steady electronic drums',        icon: Briefcase, gradient: 'from-blue-600 to-cyan-700' },
  'corporate-3':    { zhTitle: '企業 — 年報',         zhCat: '企業 / 簡報',  zhDesc: '感性年報配樂,溫暖鋼琴+情感堆疊',                                enDesc: 'Emotional annual report, warm piano + emotional build',             icon: Briefcase, gradient: 'from-blue-600 to-cyan-700' },
  // Game — red/orange
  'game-1':         { zhTitle: '遊戲 — RPG 戰鬥',     zhCat: '遊戲',         zhDesc: 'RPG 戰鬥音樂,快速弦樂+戰鼓+銅管,奇幻動作',                     enDesc: 'RPG battle, fast strings + war drums + brass, fantasy action',     icon: Gamepad2,  gradient: 'from-red-600 to-rose-800' },
  'game-2':         { zhTitle: '遊戲 — 黑暗氛圍',     zhCat: '遊戲',         zhDesc: '緊張黑暗氛圍,低音 drone+稀疏打擊,科幻恐怖探索',                enDesc: 'Tense dark ambient, low drone + sparse perc, sci-fi horror',        icon: Gamepad2,  gradient: 'from-red-600 to-rose-800' },
  'game-3':         { zhTitle: '遊戲 — 復古 8-bit',   zhCat: '遊戲',         zhDesc: '復古 8-bit 街機,合成器跳動,休閒關卡',                          enDesc: 'Retro 8-bit arcade, bouncing synths, casual level music',           icon: Gamepad2,  gradient: 'from-red-600 to-rose-800' },
  // Wellness — lavender/mint
  'wellness-1':     { zhTitle: 'Spa — 冥想',          zhCat: 'Spa / 冥想',    zhDesc: '藏鐘冥想,溫暖墊樂+自然音,深度放鬆',                            enDesc: 'Tibetan bowls meditation, warm pads + nature, deep relaxation',     icon: Leaf,      gradient: 'from-violet-500 to-emerald-600' },
  'wellness-2':     { zhTitle: 'Spa — 禪意',          zhCat: 'Spa / 冥想',    zhDesc: '軟鋼琴+缽鼓+流水聲,Spa 禪意空間',                              enDesc: 'Soft piano + hang drum + flowing water, Spa zen space',             icon: Leaf,      gradient: 'from-violet-500 to-emerald-600' },
  // Wedding — rose/cream
  'wedding-1':      { zhTitle: '婚禮 — 浪漫',         zhCat: '婚禮 / 紀念',   zhDesc: '浪漫指彈吉他+柔和弦樂,婚禮溫馨時刻',                            enDesc: 'Romantic fingerpicked guitar + soft strings, wedding moments',      icon: Heart,     gradient: 'from-rose-400 to-pink-600' },
  'wedding-2':      { zhTitle: '紀念 — 懷舊',         zhCat: '婚禮 / 紀念',   zhDesc: '懷舊回憶配樂,鋼琴+弦樂漸進,家庭紀念剪輯',                      enDesc: 'Nostalgic memory score, piano + strings build, family montage',     icon: Heart,     gradient: 'from-rose-400 to-pink-600' },
  // Kids — yellow/pink
  'kids-1':         { zhTitle: '兒童 — 烏克麗麗',     zhCat: '兒童 / 動畫',   zhDesc: '活潑兒童流行,彈跳烏克麗麗+口哨+鈴鐺',                          enDesc: 'Playful kids pop, bouncy ukulele + whistling + bells',              icon: Sparkles,  gradient: 'from-yellow-400 to-pink-500' },
  'kids-2':         { zhTitle: '兒童 — 卡通冒險',     zhCat: '兒童 / 動畫',   zhDesc: '卡通冒險音樂,馬林巴+俏皮木管,動畫喜劇感',                      enDesc: 'Cartoon adventure, marimba + playful woodwinds, animated comedy',   icon: Sparkles,  gradient: 'from-yellow-400 to-pink-500' },
  // Travel — sky/coral
  'travel-1':       { zhTitle: '旅遊 — 陽光 Vlog',    zhCat: '旅遊 / 美食',   zhDesc: '陽光旅遊 Vlog,烏克麗麗+口哨+輕打擊,夏日海灘',                  enDesc: 'Sunny travel vlog, ukulele + whistling + light perc, beach summer', icon: Plane,     gradient: 'from-sky-500 to-orange-400' },
  'travel-2':       { zhTitle: '美食 — 溫暖 Lo-Fi',   zhCat: '旅遊 / 美食',   zhDesc: '美食 Vlog 配樂,溫暖電鋼琴+lo-fi 節拍,廚房感',                   enDesc: 'Food vlog soundtrack, warm Rhodes + lo-fi beat, cozy kitchen',      icon: Plane,     gradient: 'from-sky-500 to-orange-400' },
  // Seasonal — red/gold
  'seasonal-1':     { zhTitle: '節慶 — 新春',         zhCat: '節慶 / 賀年',   zhDesc: '華人新春慶典,琵琶+古箏+太鼓,紅燈籠氛圍',                       enDesc: 'Chinese New Year celebration, pipa + guzheng + taiko, festive',     icon: Gift,      gradient: 'from-red-500 to-amber-500' },
  'seasonal-2':     { zhTitle: '節慶 — 聖誕',         zhCat: '節慶 / 賀年',   zhDesc: '聖誕魔幻雪橇,叮噹鈴+溫暖弦樂+俏皮木管',                        enDesc: 'Magical Christmas sleigh, jingle bells + warm strings + woodwinds', icon: Gift,      gradient: 'from-red-500 to-amber-500' },
  // Vocal POP — Pop Ballad
  'pop-ballad-en':  { zhTitle: '流行抒情 (英)',       zhCat: '流行抒情',     zhDesc: '情感流行抒情,親密人聲+鋼琴弦樂(英文)',                         enDesc: 'Emotional pop ballad, intimate vocal + piano strings (EN)',         icon: Piano,     gradient: 'from-purple-700 to-indigo-900' },
  'pop-ballad-cn':  { zhTitle: '流行抒情 (中) — 夜深以後', zhCat: '流行抒情', zhDesc: '華語抒情流行,中音域演唱+暖鋼琴(中文押韻)',                     enDesc: 'Mandarin pop ballad, mid-range vocal + warm piano (rhymed CN)',     icon: Piano,     gradient: 'from-purple-700 to-indigo-900' },
  // Pop Upbeat
  'pop-upbeat-en':  { zhTitle: '輕快流行 (英) — Tonight We Stay', zhCat: '輕快流行', zhDesc: '輕快流行舞曲,亮麗合成+俐落鼓+琅琅副歌(英文)',         enDesc: 'Upbeat dance-pop, glossy synth + tight drums + catchy hook (EN)',   icon: Star,      gradient: 'from-pink-500 to-fuchsia-600' },
  'pop-upbeat-cn':  { zhTitle: '輕快流行 (中) — 今夜街口',       zhCat: '輕快流行', zhDesc: '華語輕快流行,胸聲穩定+口語化副歌(中文押韻)',           enDesc: 'Mandarin upbeat pop, stable chest voice + conversational (rhymed)', icon: Star,      gradient: 'from-pink-500 to-fuchsia-600' },
  // R&B
  'rnb-smooth-en':  { zhTitle: 'R&B (英) — Slow It Down',        zhCat: 'R&B',     zhDesc: '慵懶 R&B,80s 墊樂+放克貝斯+深夜感(英文)',               enDesc: 'Smooth R&B, 80s pads + slap bass + late-night vibe (EN)',           icon: Moon,      gradient: 'from-amber-700 to-slate-900' },
  'rnb-smooth-cn':  { zhTitle: 'R&B (中) — 慢一點走',             zhCat: 'R&B',     zhDesc: '華語都會 R&B,氣音貼麥+指彈節奏(中文押韻)',              enDesc: 'Mandarin urban R&B, breathy mic-close + finger bass (rhymed CN)',   icon: Moon,      gradient: 'from-amber-700 to-slate-900' },
  // Hip-Hop
  'hiphop-trap-en': { zhTitle: '嘻哈 (英) — One Brick One Line', zhCat: '嘻哈',     zhDesc: '現代 trap,808 重低音+密集 hi-hat+自信 flow(英文)',     enDesc: 'Modern trap, 808 bass + tight hi-hats + confident flow (EN)',       icon: Mic2,      gradient: 'from-zinc-800 to-red-700' },
  'hiphop-trap-cn': { zhTitle: '嘻哈 (中) — 從零起跑',             zhCat: '嘻哈',     zhDesc: '華語 trap,中音域 flow+街頭製作感(中文押韻)',            enDesc: 'Mandarin trap, mid-range flow + street production (rhymed CN)',     icon: Mic2,      gradient: 'from-zinc-800 to-red-700' },
  // Indie
  'indie-bedroom-en':{ zhTitle: '獨立 (英) — Floorboard Afternoon',zhCat: '獨立流行',zhDesc: '夢幻獨立臥室流行,清吉他+lo-fi 鼓+柔軟人聲(英文)',      enDesc: 'Dreamy indie bedroom pop, clean guitar + lo-fi drums + soft (EN)',  icon: Cloud,     gradient: 'from-pink-300 to-violet-400' },
  'indie-bedroom-cn':{ zhTitle: '獨立 (中) — 午後地板光',         zhCat: '獨立流行',zhDesc: '華語獨立流行,溫暖內斂+空間殘響(中文押韻)',              enDesc: 'Mandarin indie pop, warm restrained + spacious reverb (rhymed)',    icon: Cloud,     gradient: 'from-pink-300 to-violet-400' },
  // K-Pop
  'kpop-idol-en':   { zhTitle: 'K-Pop (英) — Wave Call',           zhCat: 'K-Pop',    zhDesc: '高能 K-Pop,團體和聲+EDM+rap 段落(英文)',                enDesc: 'High-energy K-Pop, group harmonies + EDM + rap break (EN)',         icon: Sparkles,  gradient: 'from-fuchsia-400 to-cyan-400' },
  'kpop-idol-cn':   { zhTitle: 'K-Pop (中) — 浪起飛翔',            zhCat: 'K-Pop',    zhDesc: '華語 K-Pop,中音域和聲+精緻製作(中文押韻)',              enDesc: 'Mandarin K-Pop, mid-range harmonies + slick production (rhymed)',   icon: Sparkles,  gradient: 'from-fuchsia-400 to-cyan-400' },
  // Latin
  'latin-reggaeton-en':{ zhTitle: '拉丁 (英/西) — Marea Alta',     zhCat: '拉丁',     zhDesc: '現代 reggaeton,dembow 節奏+雙語副歌(英/西)',            enDesc: 'Modern reggaeton, dembow rhythm + bilingual hook (EN/ES)',          icon: Sun,       gradient: 'from-orange-500 to-pink-600' },
  'latin-fusion-cn':{ zhTitle: '拉丁融合 (中) — 海風上心',         zhCat: '拉丁',     zhDesc: '拉丁華語融合,dembow+陽光海島感(中文押韻)',              enDesc: 'Mandarin Latin fusion, dembow + sunny island vibe (rhymed CN)',     icon: Sun,       gradient: 'from-orange-500 to-pink-600' },
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

  const grouped = useMemo(() => {
    const filtered = rows.filter(r => Array.isArray(r.tags) && r.tags.includes(view));
    const byCat: Record<string, Row[]> = {};
    for (const r of filtered) {
      const meta = META[r.slot_key];
      const cat = isZh && meta ? meta.zhCat : r.subtitle;
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
        <div className="max-w-6xl mx-auto space-y-14">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <h2 className="text-2xl font-bold mb-5 text-white border-l-4 border-amber-500/60 pl-3">{cat}</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(row => {
                  const meta = META[row.slot_key];
                  const Icon = meta?.icon ?? Music;
                  const gradient = meta?.gradient ?? 'from-gray-600 to-gray-800';
                  const title = isZh && meta ? meta.zhTitle : row.label;
                  const desc = isZh && meta ? meta.zhDesc : meta?.enDesc ?? row.description;
                  const bpm = row.tags?.[1];
                  const playing = playingId === row.id;
                  return (
                    <div
                      key={row.id}
                      className="rounded-xl overflow-hidden bg-white/[0.03] border border-white/10 hover:border-white/20 transition group flex flex-col"
                    >
                      {/* Cover */}
                      <div className={`relative h-32 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                        <Icon className="w-12 h-12 text-white/85 drop-shadow-md" strokeWidth={1.5} />
                        <button
                          onClick={() => togglePlay(row)}
                          className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition"
                          aria-label={playing ? 'Pause' : 'Play'}
                        >
                          <div className={`w-12 h-12 rounded-full bg-black/70 backdrop-blur-sm flex items-center justify-center transition transform ${playing ? 'scale-100 opacity-100' : 'scale-90 opacity-0 group-hover:opacity-100 group-hover:scale-100'}`}>
                            {playing
                              ? <Pause className="w-5 h-5 text-white" />
                              : <Play className="w-5 h-5 text-white ml-0.5" />}
                          </div>
                        </button>
                        {playing && (
                          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/70 text-[10px] font-semibold text-amber-300 uppercase tracking-wider">
                            {isZh ? '播放中' : 'Playing'}
                          </div>
                        )}
                      </div>
                      {/* Text */}
                      <div className="p-4 flex-1 flex flex-col">
                        <p className="text-sm font-semibold text-white leading-tight mb-1">{title}</p>
                        <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">
                          BPM {bpm} · {isZh ? '40 秒預覽' : '40s preview'}
                        </p>
                        <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
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
