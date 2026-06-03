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
  Play, Pause, ArrowRight, Music, Mic2, ChevronDown,
  Zap, Film, Mic, Briefcase, Gamepad2, Leaf, Heart, Sparkles, Plane, Gift,
  Piano, Star, Moon, Cloud, Sun,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { audioManager } from '@/lib/audioManager';
import { MUSIC_LYRICS } from '@/lib/music-lyrics';
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
  title: string;       // Suno-generated title (use across all locales as-is)
  zhCat: string;       // category label, zh-TW
  zhCNCat: string;     // category label, zh-CN (simplified)
  enCat: string;       // category label, en
  zhDesc: string;      // sound description, zh-TW
  zhCNDesc: string;    // sound description, zh-CN
  enDesc: string;      // sound description, en
  icon: LucideIcon;
  gradient: string;
};

// Per-slot metadata. Title is the Suno-extracted track title (use as-is
// across all locales — Suno already names tracks in their natural language).
// Category + description have zh-TW / zh-CN / en variants.
const META: Record<string, TrackMeta> = {
  // Brand Sting
  'brand-sting-1': { title: 'Spark Up',           enCat: 'Brand Sting',  zhCat: '廣告 / 品牌',  zhCNCat: '广告 / 品牌',  enDesc: 'Short, punchy intro for 5-10s brand stings',                       zhDesc: '簡短有力的廣告片頭，適合 5-10 秒品牌標識',     zhCNDesc: '简短有力的广告片头，适合 5-10 秒品牌标识',     icon: Zap,       gradient: 'from-amber-500 to-orange-600' },
  'brand-sting-2': { title: 'Launch Day',         enCat: 'Brand Sting',  zhCat: '廣告 / 品牌',  zhCNCat: '广告 / 品牌',  enDesc: 'Glossy synths + tight drums, tech product launches',                zhDesc: '亮麗合成器穿插俐落鼓，科技公司產品發布',         zhCNDesc: '亮丽合成器穿插俐落鼓，科技公司产品发布',         icon: Zap,       gradient: 'from-amber-500 to-orange-600' },
  'brand-sting-3': { title: 'Velvet Arrival',     enCat: 'Brand Sting',  zhCat: '廣告 / 品牌',  zhCNCat: '广告 / 品牌',  enDesc: 'Slow jazz brand stinger for premium brand openers',                 zhDesc: '緩慢爵士品牌音效，適合高端品牌簡介開頭',         zhCNDesc: '缓慢爵士品牌音效，适合高端品牌简介开头',         icon: Zap,       gradient: 'from-amber-500 to-orange-600' },
  // Trailer
  'trailer-1': { title: 'Iron Horizon',           enCat: 'Trailer',      zhCat: '電影預告',     zhCNCat: '电影预告',     enDesc: 'Epic orchestra stacked layers, brass hits, blockbuster style',      zhDesc: '史詩管弦樂逐層堆疊，銅管炸裂，電影級預告',         zhCNDesc: '史诗管弦乐逐层堆叠，铜管炸裂，电影级预告',         icon: Film,      gradient: 'from-indigo-700 to-purple-900' },
  'trailer-2': { title: 'Black Glass Impact',     enCat: 'Trailer',      zhCat: '電影預告',     zhCNCat: '电影预告',     enDesc: 'Dark hybrid electronic, deep bass pulse, modern blockbuster',       zhDesc: '黑暗電子混合，深沉低音脈衝，現代大片預告',         zhCNDesc: '黑暗电子混合，深沉低音脉冲，现代大片预告',         icon: Film,      gradient: 'from-indigo-700 to-purple-900' },
  'trailer-3': { title: 'Skybound Victory',       enCat: 'Trailer',      zhCat: '電影預告',     zhCNCat: '电影预告',     enDesc: 'Heroic strings soar, choir swells, emotional payoff trailer',       zhDesc: '英雄感弦樂飆升，合唱激昂，情感釋放型預告',         zhCNDesc: '英雄感弦乐飙升，合唱激昂，情感释放型预告',         icon: Film,      gradient: 'from-indigo-700 to-purple-900' },
  // Podcast Bed
  'podcast-bed-1': { title: 'Dusty Vinyl Drift',  enCat: 'Podcast Bed',  zhCat: 'Podcast 背景',zhCNCat: 'Podcast 背景', enDesc: 'Lazy lo-fi hip-hop, vinyl crackle, late-night conversation bed',    zhDesc: '慵懶 lo-fi 嘻哈節拍，黑膠雜音，深夜對談背景',     zhCNDesc: '慵懒 lo-fi 嘻哈节拍，黑胶杂音，深夜对谈背景',     icon: Mic,       gradient: 'from-emerald-700 to-teal-800' },
  'podcast-bed-2': { title: 'After Midnight Cane',enCat: 'Podcast Bed',  zhCat: 'Podcast 背景',zhCNCat: 'Podcast 背景', enDesc: 'Smooth jazz, brushed drums + upright bass, deep interview bed',     zhDesc: '流暢爵士，刷鼓+原音貝斯，適合深度訪談',           zhCNDesc: '流畅爵士，刷鼓+原音贝斯，适合深度访谈',           icon: Mic,       gradient: 'from-emerald-700 to-teal-800' },
  'podcast-bed-3': { title: 'Warm Fingerpicked Bed', enCat: 'Podcast Bed', zhCat: 'Podcast 背景', zhCNCat: 'Podcast 背景', enDesc: 'Fingerpicked acoustic + warm pads, gentle podcast intro',         zhDesc: '木吉他指彈+溫暖墊樂，輕柔 podcast 開場',         zhCNDesc: '木吉他指弹+温暖垫乐，轻柔 podcast 开场',         icon: Mic,       gradient: 'from-emerald-700 to-teal-800' },
  // Corporate
  'corporate-1': { title: 'Glass Ceiling Rise',   enCat: 'Corporate',    zhCat: '企業 / 簡報',  zhCNCat: '企业 / 简报',  enDesc: 'Uplifting corporate, piano + strings + building drums',             zhDesc: '激勵企業簡報，鋼琴+弦樂+漸進鼓點',                 zhCNDesc: '激励企业简报，钢琴+弦乐+渐进鼓点',                 icon: Briefcase, gradient: 'from-blue-600 to-cyan-700' },
  'corporate-2': { title: 'Glass Protocol',       enCat: 'Corporate',    zhCat: '企業 / 簡報',  zhCNCat: '企业 / 简报',  enDesc: 'Tech company brand, clean synths + steady electronic drums',        zhDesc: '科技公司形象，清亮合成器+穩定電子鼓',             zhCNDesc: '科技公司形象，清亮合成器+稳定电子鼓',             icon: Briefcase, gradient: 'from-blue-600 to-cyan-700' },
  'corporate-3': { title: 'Steady Harvest',       enCat: 'Corporate',    zhCat: '企業 / 簡報',  zhCNCat: '企业 / 简报',  enDesc: 'Emotional annual report, warm piano + emotional build',             zhDesc: '感性年報配樂，溫暖鋼琴+情感堆疊',                 zhCNDesc: '感性年报配乐，温暖钢琴+情感堆叠',                 icon: Briefcase, gradient: 'from-blue-600 to-cyan-700' },
  // Game
  'game-1': { title: 'Dragon Banner Clash',       enCat: 'Game',         zhCat: '遊戲',         zhCNCat: '游戏',         enDesc: 'RPG battle, fast strings + war drums + brass, fantasy action',     zhDesc: 'RPG 戰鬥音樂，快速弦樂+戰鼓+銅管，奇幻動作',      zhCNDesc: 'RPG 战斗音乐，快速弦乐+战鼓+铜管，奇幻动作',     icon: Gamepad2,  gradient: 'from-red-600 to-rose-800' },
  'game-2': { title: 'Dead Signal Corridor',      enCat: 'Game',         zhCat: '遊戲',         zhCNCat: '游戏',         enDesc: 'Tense dark ambient, low drone + sparse perc, sci-fi horror',        zhDesc: '緊張黑暗氛圍，低音 drone+稀疏打擊，科幻恐怖探索', zhCNDesc: '紧张黑暗氛围，低音 drone+稀疏打击，科幻恐怖探索', icon: Gamepad2,  gradient: 'from-red-600 to-rose-800' },
  'game-3': { title: 'Coin-Op Comet',             enCat: 'Game',         zhCat: '遊戲',         zhCNCat: '游戏',         enDesc: 'Retro 8-bit arcade, bouncing synths, casual level music',           zhDesc: '復古 8-bit 街機，合成器跳動，休閒關卡',             zhCNDesc: '复古 8-bit 街机，合成器跳动，休闲关卡',           icon: Gamepad2,  gradient: 'from-red-600 to-rose-800' },
  // Wellness
  'wellness-1': { title: 'Stone Bowl Drift',      enCat: 'Wellness',     zhCat: 'Spa / 冥想',   zhCNCat: 'Spa / 冥想',   enDesc: 'Tibetan bowls meditation, warm pads + nature, deep relaxation',     zhDesc: '藏鐘冥想，溫暖墊樂+自然音，深度放鬆',             zhCNDesc: '藏钟冥想，温暖垫乐+自然音，深度放松',             icon: Leaf,      gradient: 'from-violet-500 to-emerald-600' },
  'wellness-2': { title: 'Rippling Zen',          enCat: 'Wellness',     zhCat: 'Spa / 冥想',   zhCNCat: 'Spa / 冥想',   enDesc: 'Soft piano + hang drum + flowing water, Spa zen space',             zhDesc: '軟鋼琴+缽鼓+流水聲，Spa 禪意空間',                 zhCNDesc: '软钢琴+钵鼓+流水声，Spa 禅意空间',                 icon: Leaf,      gradient: 'from-violet-500 to-emerald-600' },
  // Wedding
  'wedding-1': { title: 'Vowlight Chapel',        enCat: 'Wedding',      zhCat: '婚禮 / 紀念',  zhCNCat: '婚礼 / 纪念',  enDesc: 'Romantic fingerpicked guitar + soft strings, wedding moments',      zhDesc: '浪漫指彈吉他+柔和弦樂，婚禮溫馨時刻',             zhCNDesc: '浪漫指弹吉他+柔和弦乐，婚礼温馨时刻',             icon: Heart,     gradient: 'from-rose-400 to-pink-600' },
  'wedding-2': { title: 'Summer Photo Box',       enCat: 'Wedding',      zhCat: '婚禮 / 紀念',  zhCNCat: '婚礼 / 纪念',  enDesc: 'Nostalgic memory score, piano + strings build, family montage',     zhDesc: '懷舊回憶配樂，鋼琴+弦樂漸進，家庭紀念剪輯',       zhCNDesc: '怀旧回忆配乐，钢琴+弦乐渐进，家庭纪念剪辑',       icon: Heart,     gradient: 'from-rose-400 to-pink-600' },
  // Kids
  'kids-1': { title: 'Bubble Leaf Parade',        enCat: 'Kids',         zhCat: '兒童 / 動畫',  zhCNCat: '儿童 / 动画',  enDesc: 'Playful kids pop, bouncy ukulele + whistling + bells',              zhDesc: '活潑兒童流行，彈跳烏克麗麗+口哨+鈴鐺',           zhCNDesc: '活泼儿童流行，弹跳尤克里里+口哨+铃铛',           icon: Sparkles,  gradient: 'from-yellow-400 to-pink-500' },
  'kids-2': { title: 'Bouncing Banana Brigade',   enCat: 'Kids',         zhCat: '兒童 / 動畫',  zhCNCat: '儿童 / 动画',  enDesc: 'Cartoon adventure, marimba + playful woodwinds, animated comedy',   zhDesc: '卡通冒險音樂，馬林巴+俏皮木管，動畫喜劇感',       zhCNDesc: '卡通冒险音乐，马林巴+俏皮木管，动画喜剧感',       icon: Sparkles,  gradient: 'from-yellow-400 to-pink-500' },
  // Travel / Food
  'travel-1': { title: 'Drift to Shore',          enCat: 'Travel',       zhCat: '旅遊 / 美食',  zhCNCat: '旅游 / 美食',  enDesc: 'Sunny travel vlog, ukulele + whistling + light perc, beach summer', zhDesc: '陽光旅遊 Vlog，烏克麗麗+口哨+輕打擊，夏日海灘',   zhCNDesc: '阳光旅游 Vlog，尤克里里+口哨+轻打击，夏日海滩',   icon: Plane,     gradient: 'from-sky-500 to-orange-400' },
  'travel-2': { title: 'Simmer and Pour',         enCat: 'Travel',       zhCat: '旅遊 / 美食',  zhCNCat: '旅游 / 美食',  enDesc: 'Food vlog soundtrack, warm Rhodes + lo-fi beat, cozy kitchen',      zhDesc: '美食 Vlog 配樂，溫暖電鋼琴+lo-fi 節拍，廚房感',    zhCNDesc: '美食 Vlog 配乐，温暖电钢琴+lo-fi 节拍，厨房感',   icon: Plane,     gradient: 'from-sky-500 to-orange-400' },
  // Seasonal
  'seasonal-1': { title: 'Lantern Parade',        enCat: 'Seasonal',     zhCat: '節慶 / 賀年',  zhCNCat: '节庆 / 贺年',  enDesc: 'Chinese New Year celebration, pipa + guzheng + taiko, festive',     zhDesc: '華人新春慶典，琵琶+古箏+太鼓，紅燈籠氛圍',         zhCNDesc: '华人新春庆典，琵琶+古筝+太鼓，红灯笼氛围',         icon: Gift,      gradient: 'from-red-500 to-amber-500' },
  'seasonal-2': { title: 'Sleigh Bells at Dusk',  enCat: 'Seasonal',     zhCat: '節慶 / 賀年',  zhCNCat: '节庆 / 贺年',  enDesc: 'Magical Christmas sleigh, jingle bells + warm strings + woodwinds', zhDesc: '聖誕魔幻雪橇，叮噹鈴+溫暖弦樂+俏皮木管',         zhCNDesc: '圣诞魔幻雪橇，叮当铃+温暖弦乐+俏皮木管',         icon: Gift,      gradient: 'from-red-500 to-amber-500' },
  // Vocal POP
  'pop-ballad-en':     { title: 'Silence Speaks Too Loud', enCat: 'Pop Ballad',  zhCat: '流行抒情',   zhCNCat: '流行抒情', enDesc: 'Emotional pop ballad (EN), intimate vocal + piano + strings',     zhDesc: '英文情感流行抒情，親密人聲+鋼琴+弦樂',           zhCNDesc: '英文情感流行抒情，亲密人声+钢琴+弦乐',           icon: Piano,    gradient: 'from-purple-700 to-indigo-900' },
  'pop-ballad-cn':     { title: '夜深以後',              enCat: 'Pop Ballad',  zhCat: '流行抒情',   zhCNCat: '流行抒情', enDesc: 'Mandarin pop ballad, mid-range vocal + warm piano',                zhDesc: '華語抒情流行，中音域演唱+暖鋼琴，押韻歌詞',         zhCNDesc: '华语抒情流行，中音域演唱+暖钢琴，押韵歌词',         icon: Piano,    gradient: 'from-purple-700 to-indigo-900' },
  'pop-upbeat-en':     { title: 'Tonight We Stay',       enCat: 'Pop Upbeat',  zhCat: '輕快流行',   zhCNCat: '轻快流行', enDesc: 'Upbeat dance-pop (EN), glossy synth + tight drums + catchy hook',  zhDesc: '英文輕快流行舞曲，亮麗合成+俐落鼓+琅琅副歌',     zhCNDesc: '英文轻快流行舞曲，亮丽合成+俐落鼓+琅琅副歌',     icon: Star,     gradient: 'from-pink-500 to-fuchsia-600' },
  'pop-upbeat-cn':     { title: '今夜街口',              enCat: 'Pop Upbeat',  zhCat: '輕快流行',   zhCNCat: '轻快流行', enDesc: 'Mandarin upbeat pop, stable chest voice + conversational hook',    zhDesc: '華語輕快流行，胸聲穩定+口語化副歌',               zhCNDesc: '华语轻快流行，胸声稳定+口语化副歌',               icon: Star,     gradient: 'from-pink-500 to-fuchsia-600' },
  'rnb-smooth-en':     { title: 'Slow It Down',          enCat: 'R&B',         zhCat: 'R&B',        zhCNCat: 'R&B',      enDesc: 'Smooth R&B (EN), 80s pads + slap bass + late-night vibe',          zhDesc: '英文慵懶 R&B,80s 墊樂+放克貝斯+深夜感',           zhCNDesc: '英文慵懒 R&B,80s 垫乐+放克贝斯+深夜感',           icon: Moon,     gradient: 'from-amber-700 to-slate-900' },
  'rnb-smooth-cn':     { title: '慢一點走',              enCat: 'R&B',         zhCat: 'R&B',        zhCNCat: 'R&B',      enDesc: 'Mandarin urban R&B, breathy mic-close + finger bass',              zhDesc: '華語都會 R&B，氣音貼麥+指彈節奏',                 zhCNDesc: '华语都会 R&B，气音贴麦+指弹节奏',                 icon: Moon,     gradient: 'from-amber-700 to-slate-900' },
  'hiphop-trap-en':    { title: 'One Brick One Line',    enCat: 'Hip-Hop Trap',zhCat: '嘻哈',       zhCNCat: '嘻哈',     enDesc: 'Modern trap (EN), 808 bass + tight hi-hats + confident flow',      zhDesc: '英文現代 trap,808 重低音+密集 hi-hat+自信 flow', zhCNDesc: '英文现代 trap,808 重低音+密集 hi-hat+自信 flow', icon: Mic2,     gradient: 'from-zinc-800 to-red-700' },
  'hiphop-trap-cn':    { title: '從零起跑',              enCat: 'Hip-Hop Trap',zhCat: '嘻哈',       zhCNCat: '嘻哈',     enDesc: 'Mandarin trap, mid-range flow + street production',                zhDesc: '華語 trap，中音域 flow+街頭製作感',               zhCNDesc: '华语 trap，中音域 flow+街头制作感',               icon: Mic2,     gradient: 'from-zinc-800 to-red-700' },
  'indie-bedroom-en':  { title: 'Floorboard Afternoon',  enCat: 'Indie',       zhCat: '獨立流行',   zhCNCat: '独立流行', enDesc: 'Dreamy indie bedroom pop (EN), clean guitar + lo-fi drums + soft', zhDesc: '英文夢幻獨立臥室流行，清吉他+lo-fi 鼓+柔軟人聲',   zhCNDesc: '英文梦幻独立卧室流行，清吉他+lo-fi 鼓+柔软人声',   icon: Cloud,    gradient: 'from-pink-300 to-violet-400' },
  'indie-bedroom-cn':  { title: '午後地板光',            enCat: 'Indie',       zhCat: '獨立流行',   zhCNCat: '独立流行', enDesc: 'Mandarin indie pop, warm restrained + spacious reverb',            zhDesc: '華語獨立流行，溫暖內斂+空間殘響',                 zhCNDesc: '华语独立流行，温暖内敛+空间残响',                 icon: Cloud,    gradient: 'from-pink-300 to-violet-400' },
  'kpop-idol-en':      { title: 'Wave Call',             enCat: 'K-Pop',       zhCat: 'K-Pop',      zhCNCat: 'K-Pop',    enDesc: 'High-energy K-Pop (EN), group harmonies + EDM + rap break',        zhDesc: '英文高能 K-Pop，團體和聲+EDM+rap 段落',           zhCNDesc: '英文高能 K-Pop，团体和声+EDM+rap 段落',           icon: Sparkles, gradient: 'from-fuchsia-400 to-cyan-400' },
  'kpop-idol-cn':      { title: '浪起飛翔',              enCat: 'K-Pop',       zhCat: 'K-Pop',      zhCNCat: 'K-Pop',    enDesc: 'Mandarin K-Pop, mid-range harmonies + slick production',           zhDesc: '華語 K-Pop，中音域和聲+精緻製作',                 zhCNDesc: '华语 K-Pop，中音域和声+精致制作',                 icon: Sparkles, gradient: 'from-fuchsia-400 to-cyan-400' },
  'latin-reggaeton-en':{ title: 'Marea Alta',            enCat: 'Latin',       zhCat: '拉丁',       zhCNCat: '拉丁',     enDesc: 'Modern reggaeton, dembow rhythm + bilingual EN/ES hook',           zhDesc: '現代 reggaeton,dembow 節奏+雙語副歌(英/西)',     zhCNDesc: '现代 reggaeton,dembow 节奏+双语副歌(英/西)',     icon: Sun,      gradient: 'from-orange-500 to-pink-600' },
  'latin-fusion-cn':   { title: '海風上心',              enCat: 'Latin',       zhCat: '拉丁',       zhCNCat: '拉丁',     enDesc: 'Mandarin Latin fusion, dembow + sunny island vibe',                zhDesc: '拉丁華語融合，dembow+陽光海島感',                 zhCNDesc: '拉丁华语融合，dembow+阳光海岛感',                 icon: Sun,      gradient: 'from-orange-500 to-pink-600' },
};

export default function MusicCatalogPage() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  // Pick the right localized field from a TrackMeta record.
  const pickCat = (m: TrackMeta | undefined, fallback: string) =>
    !m ? fallback : isZhCN ? m.zhCNCat : isZh ? m.zhCat : m.enCat;
  const pickDesc = (m: TrackMeta | undefined, fallback: string) =>
    !m ? fallback : isZhCN ? m.zhCNDesc : isZh ? m.zhDesc : m.enDesc;
  // Per-locale UI string helper. Order: [zh-TW, zh-CN, en]
  const tx = (tw: string, cn: string, en: string) =>
    isZhCN ? cn : isZh ? tw : en;
  const [rows, setRows] = useState<Row[]>([]);
  const [view, setView] = useState<'instrumental' | 'vocal'>('instrumental');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [openLyrics, setOpenLyrics] = useState<Set<string>>(new Set());
  // 0..1 progress for the currently-playing track, updated on the
  // audio element's timeupdate event. Single value because only one
  // track plays at a time (audioManager enforces this).
  const [progress, setProgress] = useState(0);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  const toggleLyrics = (id: string) => {
    setOpenLyrics(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };


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
      const cat = pickCat(meta, r.subtitle);
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(r);
    }
    return byCat;
  }, [rows, view, isZh, isZhCN]);

  const togglePlay = (row: Row) => {
    if (playingId === row.id) {
      audioRefs.current[row.id]?.pause();
      audioManager.stop(audioRefs.current[row.id]);
      setPlayingId(null);
      setProgress(0);
      return;
    }
    if (!audioRefs.current[row.id]) {
      audioRefs.current[row.id] = new Audio(row.audio_url);
      audioRefs.current[row.id].onended = () => {
        setPlayingId(null);
        setProgress(0);
        audioManager.stop(audioRefs.current[row.id]);
      };
      audioRefs.current[row.id].ontimeupdate = () => {
        const el = audioRefs.current[row.id];
        if (el && el.duration > 0) setProgress(el.currentTime / el.duration);
      };
    }
    const a = audioRefs.current[row.id];
    audioManager.play(a, () => { setPlayingId(null); setProgress(0); });
    a.play();
    setPlayingId(row.id);
    setProgress(0);
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="pt-32 pb-12 px-4 text-center relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(168,85,247,0.08),transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            {tx('音樂庫', '音乐库', 'Music Library')}
          </h1>
          <p className="text-gray-400 text-lg">
            {tx(
              '挑一首作為起點 — 我們會以你選的方向客製化最終曲目。',
              '挑一首作为起点 — 我们会以你选的方向定制最终曲目。',
              'Pick a starting point — we customize the final track in the direction you choose.'
            )}
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
            {tx('配音底音', '配音底音', 'Instrumental Bed')}
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
            {tx('POP 帶人聲', 'POP 带人声', 'Vocal POP')}
          </button>
        </div>
      </section>

      <section className="px-4 pb-24">
        <div className="max-w-6xl mx-auto space-y-14">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <h2 className="text-2xl font-bold mb-5 text-white border-l-4 border-amber-500/60 pl-3">{cat}</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map(row => {
                  const meta = META[row.slot_key];
                  const gradient = meta?.gradient ?? 'from-gray-600 to-gray-800';
                  // Suno-generated title; same across locales (it's the song's actual name)
                  const title = meta?.title ?? row.label;
                  const desc = pickDesc(meta, row.description);
                  const catLabel = pickCat(meta, row.subtitle);
                  const playing = playingId === row.id;
                  const lyricsOpen = openLyrics.has(row.id);
                  const lyrics = MUSIC_LYRICS[row.slot_key];
                  const hasLyrics = !!lyrics;
                  return (
                    <div
                      key={row.id}
                      className={`relative rounded-xl bg-zinc-950/60 border transition-all duration-200 overflow-hidden ${
                        playing
                          ? 'border-white/40 shadow-[0_0_24px_-10px_rgba(255,255,255,0.25)]'
                          : 'border-white/10 hover:border-white/25 hover:bg-zinc-900/60'
                      }`}
                    >
                      {/* Compact horizontal layout: small square thumbnail
                          (~88px) on the left, text + play on the right.
                          Inspired by Spotify/Apple Music list rows. */}
                      <div className="flex items-stretch gap-3 p-3">
                        {/* Thumbnail */}
                        <div className={`relative shrink-0 w-[88px] h-[88px] rounded-lg overflow-hidden bg-gradient-to-br ${gradient}`}>
                          <img
                            src={`https://hnblwckpnapsdladcjql.supabase.co/storage/v1/object/public/music-samples/covers/${row.slot_key}.jpg`}
                            alt={title}
                            loading="lazy"
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                          />
                          {playing && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            </div>
                          )}
                        </div>

                        {/* Text + play */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between gap-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-white leading-tight truncate">{title}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5 truncate uppercase tracking-wider">
                                {catLabel}
                              </p>
                            </div>
                            <button
                              onClick={() => togglePlay(row)}
                              className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition shadow-md ${
                                playing
                                  ? 'bg-white text-black hover:bg-gray-100'
                                  : 'bg-white text-black hover:scale-105'
                              }`}
                              aria-label={playing ? 'Pause' : 'Play'}
                            >
                              {playing
                                ? <Pause className="w-4 h-4" fill="currentColor" />
                                : <Play className="w-4 h-4 ml-0.5" fill="currentColor" />}
                            </button>
                          </div>
                          <p className="text-[11px] text-gray-400 leading-snug line-clamp-2">{desc}</p>
                        </div>
                      </div>

                      {/* Footer row: lyrics toggle (vocal only) on the left,
                          dual CTAs on the right.

                          Two paths for this track:
                          1. Quick checkout (Tier 1 AI Curator $999) — for
                             standardized scope. Goes to /music/create
                             configurator + Paddle.
                          2. Send brief — for Tier 2/3 custom work where a
                             human-reviewed quote is needed first. Goes to
                             /music/brief.

                          See pricing-page hybrid routing for the rationale. */}
                      <div className="px-3 pb-3 -mt-1 flex items-center justify-between gap-2">
                        {hasLyrics ? (
                          <button
                            onClick={() => toggleLyrics(row.id)}
                            className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-white transition uppercase tracking-wider font-semibold"
                          >
                            <ChevronDown className={`w-3 h-3 transition-transform ${lyricsOpen ? 'rotate-180' : ''}`} />
                            {tx('看歌詞', '看歌词', 'Lyrics')}
                          </button>
                        ) : <span />}
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/music/create?track=${row.slot_key}&trackTitle=${encodeURIComponent(title)}&tier=ai-curator`}
                            className="text-[10px] text-gray-400 hover:text-white transition uppercase tracking-wider font-semibold"
                          >
                            {tx('直接結帳 →', '直接结账 →', 'Direct checkout →')}
                          </Link>
                          <Link
                            href={`/music/brief?track=${row.slot_key}&trackTitle=${encodeURIComponent(title)}`}
                            className="text-[10px] text-amber-400 hover:text-amber-300 transition uppercase tracking-wider font-semibold"
                          >
                            {tx('送 brief 詢價 →', '送 brief 询价 →', 'Send brief →')}
                          </Link>
                        </div>
                      </div>
                      {hasLyrics && lyricsOpen && (
                        <div className="px-3 pb-3">
                          <pre className="p-3 rounded-lg bg-black/40 border border-white/5 text-[11px] text-gray-300 font-sans whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                            {lyrics}
                          </pre>
                        </div>
                      )}

                      {/* Bandcamp-style thin progress bar at the bottom
                          edge of the playing card. Click-to-seek: clicking
                          any point in the track length jumps audio there. */}
                      {playing && (
                        <div
                          className="absolute left-0 right-0 bottom-0 h-[3px] bg-white/10 cursor-pointer group"
                          onClick={(e) => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            const pct = (e.clientX - rect.left) / rect.width;
                            const a = audioRefs.current[row.id];
                            if (a && a.duration > 0) {
                              a.currentTime = Math.max(0, Math.min(1, pct)) * a.duration;
                            }
                          }}
                        >
                          <div
                            className="h-full bg-amber-400 transition-[width] duration-150 ease-linear"
                            style={{ width: `${Math.round(progress * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <p className="text-center text-gray-500 py-20">
              {tx('正在載入...', '正在加载...', 'Loading...')}
            </p>
          )}
        </div>
      </section>

      <section className="px-4 pb-24">
        <div className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-4">
          {/* Path A: direct checkout (Tier 1) */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border border-cyan-500/20 text-center">
            <p className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold mb-2">
              {tx('直接結帳', '直接结账', 'Direct checkout')}
            </p>
            <h3 className="text-xl font-bold mb-2">
              Tier 1 AI Curator
              <span className="text-cyan-400 ml-2">US$999</span>
            </h3>
            <p className="text-sm text-gray-400 mb-5 leading-relaxed">
              {tx(
                'AI 生成 · 專業混音 · 2 輪修改。填規格直接結帳，24-48 小時交件。',
                'AI 生成 · 专业混音 · 2 轮修改。填规格直接结账，24-48 小时交件。',
                'AI composition · pro mix · 2 revisions. Fill specs, check out, delivered in 24-48h.'
              )}
            </p>
            <Link
              href="/music/create?tier=ai-curator"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition"
            >
              {tx('Tier 1 快速下單', 'Tier 1 快速下单', 'Quick checkout')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Path B: brief (Tier 2/3 + bespoke) */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 to-pink-500/5 border border-amber-500/20 text-center">
            <p className="text-[10px] uppercase tracking-widest text-amber-400 font-bold mb-2">
              {tx('報價製作', '报价制作', 'Get a quote')}
            </p>
            <h3 className="text-xl font-bold mb-2">
              {tx('Tier 2 / 3 真人製作', 'Tier 2 / 3 真人制作', 'Tier 2 / 3 Human production')}
              <span className="text-amber-400 ml-2">US$2,499+</span>
            </h3>
            <p className="text-sm text-gray-400 mb-5 leading-relaxed">
              {tx(
                '真人編曲 · Live 弦樂 · 版權買斷。送 brief 後 24 小時內回覆報價，接受才付款。',
                '真人编曲 · Live 弦乐 · 版权买断。送 brief 后 24 小时内回复报价，接受才付款。',
                'Human producer · live strings · copyright buyout. Quote in 24h after you send the brief; payment only on acceptance.'
              )}
            </p>
            <Link
              href="/music/brief"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition"
            >
              {tx('送 brief 詢價', '送 brief 询价', 'Send brief')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
