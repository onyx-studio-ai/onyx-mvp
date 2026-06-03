'use client';

/**
 * /music/brief — dedicated music-production brief form.
 *
 * Flow: /music/catalog → user picks a track ("Use this →") →
 * /music/brief?track=<slot_key>&trackTitle=<title> → user fills
 * structured fields → POST /api/contact/send with formatted message
 * + department=PRODUCTION → 24h human-reviewed quote follows by email.
 *
 * Why a dedicated brief page (not generic /contact): bespoke music
 * production at our $999+ tiers depends on dimensions a free-text
 * "contact us" can't capture cleanly — production tier (AI vs human
 * vs full buyout), live strings add-on, length, language, usage
 * scope, deadline, lyric handling, references, deliverables. Capture
 * them up-front so the producer can return a real number on the
 * first reply instead of doing 4 rounds of follow-up. Same inquiry-
 * first pattern as MusicBed / Marmoset / Audio Network at this
 * price tier.
 *
 * The production tier and strings add-on options here mirror
 * lib/config/pricing.config.ts (MUSIC_TIERS + MUSIC_STRING_ADDONS).
 */

import { useState, useEffect, useRef, FormEvent, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Play, Pause, Loader2, CheckCircle2, ArrowLeft, Music, Sparkles, Crown, Wand2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { audioManager } from '@/lib/audioManager';
import Footer from '@/components/landing/Footer';

const STORAGE_BASE = 'https://hnblwckpnapsdladcjql.supabase.co/storage/v1/object/public/music-samples/covers';

type Tier = 'ai-curator' | 'pro-arrangement' | 'masterpiece' | 'advise';
type Strings = 'none' | 'intimate-12' | 'rich-16' | 'cinematic-24' | 'advise';
type ProjectType = 'ad' | 'trailer' | 'podcast' | 'corporate' | 'game' | 'wellness' | 'wedding' | 'kids' | 'travel' | 'seasonal' | 'song' | 'other';
type LengthBucket = '15s' | '30s' | '60s' | '90s' | '2min' | '3min' | 'longer' | 'custom';
type Usage = 'web' | 'broadcast' | 'allMedia' | 'unsure';
type Deadline = 'rush24h' | 'days3' | 'week1' | 'weeks2' | 'flexible';
type Lyrics = 'reuseDemo' | 'iProvide' | 'youWrite' | 'na';
type VocalGender = 'male' | 'female' | 'duet' | 'group' | 'noPref' | 'na';

const LANGS = [
  { code: 'zh-TW', label: { tw: '繁體中文', cn: '繁体中文', en: 'Traditional Chinese' } },
  { code: 'zh-CN', label: { tw: '簡體中文', cn: '简体中文', en: 'Simplified Chinese' } },
  { code: 'en',    label: { tw: '英文',     cn: '英文',     en: 'English' } },
  { code: 'ja',    label: { tw: '日文',     cn: '日文',     en: 'Japanese' } },
  { code: 'ko',    label: { tw: '韓文',     cn: '韩文',     en: 'Korean' } },
  { code: 'es',    label: { tw: '西班牙文', cn: '西班牙文', en: 'Spanish' } },
  { code: 'fr',    label: { tw: '法文',     cn: '法文',     en: 'French' } },
  { code: 'de',    label: { tw: '德文',     cn: '德文',     en: 'German' } },
  { code: 'other', label: { tw: '其他',     cn: '其他',     en: 'Other' } },
] as const;

const DELIVERABLE_OPTIONS = [
  { code: 'fullMix',     label: { tw: '完整混音版(主版)',       cn: '完整混音版(主版)',     en: 'Full mix (master)' } },
  { code: 'instrumental',label: { tw: '純配樂版(去人聲)',        cn: '纯配乐版(去人声)',      en: 'Instrumental version (no vocals)' } },
  { code: 'edit30',      label: { tw: '30 秒剪輯版',                cn: '30 秒剪辑版',              en: '30s edit' } },
  { code: 'edit15',      label: { tw: '15 秒剪輯版',                cn: '15 秒剪辑版',              en: '15s edit' } },
  { code: 'sting',       label: { tw: '5-10 秒 Sting / 片尾',       cn: '5-10 秒 Sting / 片尾',     en: '5-10s sting / tag' } },
  { code: 'stems',       label: { tw: '分軌 Stems(剪輯師用)',     cn: '分轨 Stems(剪辑师用)',     en: 'Stems / split tracks (for editor)' } },
] as const;

function BriefPageInner() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  const searchParams = useSearchParams();
  const trackSlug = searchParams.get('track') || '';
  const trackTitle = searchParams.get('trackTitle') || '';
  // Tier may be passed in by the pricing page (?tier=pro-arrangement etc.)
  // so the relevant card is pre-selected. Valid values match TIER_CARDS ids.
  const tierParam = searchParams.get('tier') || '';

  const [trackAudioUrl, setTrackAudioUrl] = useState('');
  const [trackSubtitle, setTrackSubtitle] = useState('');
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [projectName, setProjectName] = useState('');
  // Pre-select tier from URL param if valid. Whitelist before assigning
  // so a junk ?tier= can't break type assumptions.
  const validTier = (['ai-curator','pro-arrangement','masterpiece','advise'] as const)
    .includes(tierParam as Tier) ? (tierParam as Tier) : '';
  const [tier, setTier] = useState<Tier | ''>(validTier);
  const [strings, setStrings] = useState<Strings | ''>('');
  const [projectType, setProjectType] = useState<ProjectType | ''>('');
  const [lengthBucket, setLengthBucket] = useState<LengthBucket | ''>('');
  const [customLength, setCustomLength] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [usage, setUsage] = useState<Usage | ''>('');
  const [deadline, setDeadline] = useState<Deadline | ''>('');
  const [lyrics, setLyrics] = useState<Lyrics | ''>('');
  const [vocalGender, setVocalGender] = useState<VocalGender | ''>('');
  const [deliverables, setDeliverables] = useState<string[]>(['fullMix']);
  const [referenceTracks, setReferenceTracks] = useState('');
  const [avoidList, setAvoidList] = useState('');
  const [notes, setNotes] = useState('');

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [inquiryNumber, setInquiryNumber] = useState('');

  // Heuristic: vocal-track? (drives whether we ask about vocals/lyrics)
  const isVocalContext = projectType === 'song'
    || trackSlug.includes('-en')
    || trackSlug.includes('-cn');

  // Pull the picked track's audio_url + subtitle from Supabase so the
  // user can replay it here (validates the pick).
  useEffect(() => {
    if (!trackSlug) return;
    supabase
      .from('audio_showcases')
      .select('audio_url, subtitle')
      .eq('section', 'music_library')
      .eq('slot_key', trackSlug)
      .single()
      .then(({ data }) => {
        if (data) {
          setTrackAudioUrl(data.audio_url || '');
          setTrackSubtitle(data.subtitle || '');
        }
      });
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioManager.stop(audioRef.current);
      }
    };
  }, [trackSlug]);

  const togglePlay = () => {
    if (!trackAudioUrl) return;
    if (playing) {
      audioRef.current?.pause();
      if (audioRef.current) audioManager.stop(audioRef.current);
      setPlaying(false);
      return;
    }
    if (!audioRef.current) {
      audioRef.current = new Audio(trackAudioUrl);
      audioRef.current.onended = () => { setPlaying(false); setProgress(0); };
      audioRef.current.ontimeupdate = () => {
        const a = audioRef.current;
        if (a && a.duration > 0) setProgress(a.currentTime / a.duration);
      };
    }
    audioManager.play(audioRef.current, () => { setPlaying(false); setProgress(0); });
    audioRef.current.play();
    setPlaying(true);
    setProgress(0);
  };

  const toggleLanguage = (code: string) => {
    setLanguages(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  };
  const toggleDeliverable = (code: string) => {
    setDeliverables(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  };

  // Production-tier card data. Prices come from pricing.config.ts —
  // duplicated here as constants since this is a form (the canonical
  // source still owns the pricing page).
  const TIER_CARDS: { id: Tier; nameTw: string; nameCn: string; nameEn: string; priceLabel: string; descTw: string; descCn: string; descEn: string; icon: typeof Wand2; gradient: string; popular?: boolean }[] = [
    {
      id: 'ai-curator', icon: Wand2,
      nameTw: 'AI Curator', nameCn: 'AI Curator', nameEn: 'AI Curator',
      priceLabel: 'US$999',
      descTw: 'AI 生成 · 專業混音 · 2 輪修改 · 非獨家授權',
      descCn: 'AI 生成 · 专业混音 · 2 轮修改 · 非独家授权',
      descEn: 'AI composition · pro mix · 2 revisions · non-exclusive license',
      gradient: 'from-slate-700 to-slate-800',
    },
    {
      id: 'pro-arrangement', icon: Sparkles,
      nameTw: 'Pro Arrangement', nameCn: 'Pro Arrangement', nameEn: 'Pro Arrangement',
      priceLabel: 'US$2,499',
      descTw: '真人製作人 · Live 吉他 · Master 版權 · 3 輪修改',
      descCn: '真人制作人 · Live 吉他 · Master 版权 · 3 轮修改',
      descEn: 'Human producer · live guitar · master rights · 3 revisions',
      gradient: 'from-blue-600 to-cyan-700', popular: true,
    },
    {
      id: 'masterpiece', icon: Crown,
      nameTw: 'Masterpiece', nameCn: 'Masterpiece', nameEn: 'Masterpiece',
      priceLabel: 'US$4,999',
      descTw: '完整版權買斷 · 專屬製作人 · 5 輪修改 · 可加 Live 弦樂',
      descCn: '完整版权买断 · 专属制作人 · 5 轮修改 · 可加 Live 弦乐',
      descEn: 'Full buyout · dedicated producer · 5 revisions · live strings option',
      gradient: 'from-amber-600 to-orange-700',
    },
    {
      id: 'advise', icon: Music,
      nameTw: '請建議我', nameCn: '请建议我', nameEn: 'Recommend for me',
      priceLabel: '',
      descTw: '不確定哪個適合 — 讓 Onyx 看完 brief 後建議',
      descCn: '不确定哪个适合 — 让 Onyx 看完 brief 后建议',
      descEn: 'Not sure which tier fits — let Onyx review and advise',
      gradient: 'from-zinc-700 to-zinc-800',
    },
  ];

  const STRING_CARDS: { id: Strings; nameTw: string; nameCn: string; nameEn: string; priceLabel: string }[] = [
    { id: 'none',         nameTw: '不加弦樂',          nameCn: '不加弦乐',          nameEn: 'No strings',                priceLabel: '' },
    { id: 'intimate-12',  nameTw: '12 人 親密弦樂',    nameCn: '12 人 亲密弦乐',    nameEn: 'Intimate Ensemble (12)',    priceLabel: '+US$749' },
    { id: 'rich-16',      nameTw: '16 人 標準弦樂',    nameCn: '16 人 标准弦乐',    nameEn: 'Rich Studio Strings (16)',  priceLabel: '+US$899' },
    { id: 'cinematic-24', nameTw: '24 人 電影級',      nameCn: '24 人 电影级',      nameEn: 'Cinematic Symphony (24)',   priceLabel: '+US$1,299' },
    { id: 'advise',       nameTw: '請建議我',           nameCn: '请建议我',           nameEn: 'Recommend for me',          priceLabel: '' },
  ];

  // Display labels for picked values (used in submission email body).
  const labelFor = {
    tier: (k: Tier): string => {
      const c = TIER_CARDS.find(x => x.id === k);
      if (!c) return k;
      const name = isZhCN ? c.nameCn : isZh ? c.nameTw : c.nameEn;
      return c.priceLabel ? `${name} (${c.priceLabel})` : name;
    },
    strings: (k: Strings): string => {
      const c = STRING_CARDS.find(x => x.id === k);
      if (!c) return k;
      const name = isZhCN ? c.nameCn : isZh ? c.nameTw : c.nameEn;
      return c.priceLabel ? `${name} ${c.priceLabel}` : name;
    },
    projectType: (k: ProjectType): string => ({
      ad:        tx('廣告 / 品牌', '广告 / 品牌',  'Ad / Brand'),
      trailer:   tx('電影預告',     '电影预告',    'Trailer'),
      podcast:   tx('Podcast 背景','Podcast 背景','Podcast'),
      corporate: tx('企業 / 簡報', '企业 / 简报', 'Corporate'),
      game:      tx('遊戲',         '游戏',        'Game'),
      wellness:  tx('Spa / 冥想',   'Spa / 冥想',  'Wellness'),
      wedding:   tx('婚禮 / 紀念',  '婚礼 / 纪念', 'Wedding / Memory'),
      kids:      tx('兒童 / 動畫',  '儿童 / 动画', 'Kids / Animation'),
      travel:    tx('旅遊 / 美食',  '旅游 / 美食', 'Travel / Food'),
      seasonal:  tx('節慶 / 賀年',  '节庆 / 贺年', 'Seasonal'),
      song:      tx('歌曲 / POP',   '歌曲 / POP',  'Song / POP'),
      other:     tx('其他',         '其他',        'Other'),
    }[k]),
    lengthBucket: (k: LengthBucket): string => ({
      '15s':    '15s',
      '30s':    '30s',
      '60s':    '60s',
      '90s':    '90s',
      '2min':   tx('2 分鐘', '2 分钟', '2 min'),
      '3min':   tx('3 分鐘', '3 分钟', '3 min'),
      longer:   tx('更長',   '更长',   'Longer'),
      custom:   tx(`自訂: ${customLength}秒`, `自定: ${customLength}秒`, `Custom: ${customLength}s`),
    }[k]),
    usage: (k: Usage): string => ({
      web:        tx('僅限網路(社群、官網、YouTube)', '仅限网络(社群、官网、YouTube)', 'Web only (social, site, YouTube)'),
      broadcast:  tx('電視 + 網路',                       '电视 + 网络',                       'Broadcast + Web'),
      allMedia:   tx('全媒體授權',                         '全媒体授权',                         'All-media license'),
      unsure:     tx('不確定，請建議',                       '不确定，请建议',                       'Not sure — advise me'),
    }[k]),
    deadline: (k: Deadline): string => ({
      rush24h:  tx('24 小時內(加急)', '24 小时内(加急)', '24h rush'),
      days3:    tx('3 天內',           '3 天内',           'Within 3 days'),
      week1:    tx('1 週內',           '1 周内',           'Within 1 week'),
      weeks2:   tx('2 週內',           '2 周内',           'Within 2 weeks'),
      flexible: tx('彈性',             '弹性',             'Flexible'),
    }[k]),
    lyrics: (k: Lyrics): string => ({
      reuseDemo: tx('用 demo 原詞為基礎，小幅調整', '用 demo 原词为基础，小幅调整', "Reuse demo lyrics with minor tweaks"),
      iProvide:  tx('我提供完整歌詞',                '我提供完整歌词',                'I will provide full lyrics'),
      youWrite:  tx('幫我重寫(說明主題即可)',      '帮我重写(说明主题即可)',      'You write new lyrics (I describe the theme)'),
      na:        tx('不適用(純配樂)',              '不适用(纯配乐)',              'N/A (instrumental only)'),
    }[k]),
    vocalGender: (k: VocalGender): string => ({
      male:    tx('男聲',          '男声',          'Male'),
      female:  tx('女聲',          '女声',          'Female'),
      duet:    tx('對唱(2 人)',  '对唱(2 人)',  'Duet (2 vocalists)'),
      group:   tx('團體和聲',      '团体和声',      'Group / harmonies'),
      noPref:  tx('無偏好',        '无偏好',        'No preference'),
      na:      tx('不適用',        '不适用',        'N/A (instrumental)'),
    }[k]),
    deliverable: (code: string): string => {
      const it = DELIVERABLE_OPTIONS.find(x => x.code === code);
      if (!it) return code;
      return isZhCN ? it.label.cn : isZh ? it.label.tw : it.label.en;
    },
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim()) {
      toast.error(tx('請填姓名 + Email', '请填姓名 + Email', 'Please fill in name + email'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error(tx('Email 格式不對', 'Email 格式不对', 'Please enter a valid email'));
      return;
    }
    if (!tier || !projectType || !lengthBucket || !usage || !deadline) {
      toast.error(tx(
        '請填製作等級 / 專案類型 / 長度 / 用途 / 交期',
        '请填制作等级 / 项目类型 / 长度 / 用途 / 交期',
        'Please pick tier, project type, length, usage, and deadline'
      ));
      return;
    }
    if (lengthBucket === 'custom' && !customLength.trim()) {
      toast.error(tx('請填自訂長度(秒)', '请填自定长度(秒)', 'Please enter custom length (seconds)'));
      return;
    }

    // Producer email body. Sectioned + labelled so it reads like a
    // proper brief instead of a wall of text.
    const lines: string[] = [];
    lines.push(tx('=== 音樂製作 Brief ===', '=== 音乐制作 Brief ===', '=== Music Production Brief ==='));
    lines.push('');

    // Section 1: starting reference
    lines.push(tx('▎ 起點曲目', '▎ 起点曲目', '▎ Starting reference'));
    if (trackSlug) {
      lines.push(`  ${trackTitle || trackSlug} (${trackSlug})`);
    } else {
      lines.push(tx('  (未指定 — 純文字 brief)', '  (未指定 — 纯文字 brief)', '  (none — text-only brief)'));
    }
    lines.push('');

    // Section 2: tier + add-ons
    lines.push(tx('▎ 製作等級', '▎ 制作等级', '▎ Production tier'));
    lines.push(`  ${labelFor.tier(tier)}`);
    if (strings) lines.push(tx('  弦樂 add-on: ', '  弦乐 add-on: ', '  Strings add-on: ') + labelFor.strings(strings));
    lines.push('');

    // Section 3: project specs
    lines.push(tx('▎ 專案規格', '▎ 项目规格', '▎ Project specs'));
    if (projectName.trim()) lines.push(tx('  專案 / 品牌名: ', '  项目 / 品牌名: ', '  Project / brand name: ') + projectName.trim());
    lines.push((tx('  類型: ', '  类型: ', '  Type: ')) + labelFor.projectType(projectType));
    lines.push((tx('  長度: ', '  长度: ', '  Length: ')) + labelFor.lengthBucket(lengthBucket));
    if (languages.length) {
      const langNames = languages.map(c => {
        const item = LANGS.find(l => l.code === c);
        return item ? (isZhCN ? item.label.cn : isZh ? item.label.tw : item.label.en) : c;
      });
      lines.push((tx('  語言: ', '  语言: ', '  Languages: ')) + langNames.join(', '));
    }
    lines.push((tx('  用途: ', '  用途: ', '  Usage: ')) + labelFor.usage(usage));
    lines.push((tx('  交期: ', '  交期: ', '  Deadline: ')) + labelFor.deadline(deadline));
    lines.push('');

    // Section 4: vocals (only if relevant)
    if (isVocalContext && (lyrics || vocalGender)) {
      lines.push(tx('▎ 人聲', '▎ 人声', '▎ Vocals'));
      if (lyrics) lines.push((tx('  歌詞: ', '  歌词: ', '  Lyrics: ')) + labelFor.lyrics(lyrics));
      if (vocalGender) lines.push((tx('  人聲: ', '  人声: ', '  Vocal: ')) + labelFor.vocalGender(vocalGender));
      lines.push('');
    }

    // Section 5: deliverables
    if (deliverables.length) {
      lines.push(tx('▎ 交付規格', '▎ 交付规格', '▎ Deliverables'));
      deliverables.forEach(d => lines.push(`  • ${labelFor.deliverable(d)}`));
      lines.push('');
    }

    // Section 6: creative direction
    if (referenceTracks.trim() || avoidList.trim()) {
      lines.push(tx('▎ 創意方向', '▎ 创意方向', '▎ Creative direction'));
      if (referenceTracks.trim()) {
        lines.push(tx('  參考曲目:', '  参考曲目:', '  References:'));
        referenceTracks.trim().split('\n').forEach(line => lines.push(`    ${line}`));
      }
      if (avoidList.trim()) {
        lines.push(tx('  避免:', '  避免:', '  Avoid:'));
        avoidList.trim().split('\n').forEach(line => lines.push(`    ${line}`));
      }
      lines.push('');
    }

    // Section 7: contact + notes
    lines.push(tx('▎ 聯絡 + 補充', '▎ 联络 + 补充', '▎ Contact + notes'));
    if (company.trim()) lines.push((tx('  公司: ', '  公司: ', '  Company: ')) + company.trim());
    if (notes.trim()) {
      lines.push(tx('  補充說明:', '  补充说明:', '  Notes:'));
      notes.trim().split('\n').forEach(line => lines.push(`    ${line}`));
    }

    const messageBody = lines.join('\n');

    setSending(true);
    try {
      const res = await fetch('/api/contact/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: messageBody,
          department: 'PRODUCTION',
          source: 'music-brief',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'send failed');
      setInquiryNumber(data.inquiryNumber || '');
      setSent(true);
    } catch (err) {
      toast.error(tx(
        '送出失敗，請稍後再試或寫信到 produce@onyxstudios.ai',
        '送出失败，请稍后再试或写信到 produce@onyxstudios.ai',
        'Send failed, please retry or email produce@onyxstudios.ai'
      ));
      console.error('[Music Brief] submit error:', err);
    } finally {
      setSending(false);
    }
  };

  // ---- Success state ----------------------------------------------------
  if (sent) {
    return (
      <main className="min-h-screen bg-black text-white">
        <section className="pt-32 pb-20 px-4">
          <div className="max-w-xl mx-auto text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-400 mb-6" />
            <h1 className="text-3xl md:text-4xl font-bold mb-3">
              {tx('收到 brief 了', '收到 brief 了', "Brief received")}
            </h1>
            <p className="text-gray-400 mb-6">
              {tx(
                '製作團隊會在 1 個工作日內以 email 回覆報價與製作時程。',
                '制作团队会在 1 个工作日内以 email 回复报价与制作时程。',
                'Our production team will email you a quote and timeline within 1 business day.'
              )}
            </p>
            {inquiryNumber && (
              <div className="inline-block px-4 py-2 rounded-lg bg-white/5 border border-white/10 mb-8">
                <span className="text-gray-400 text-sm mr-2">{tx('參考編號', '参考编号', 'Reference')}:</span>
                <span className="font-mono text-amber-400">{inquiryNumber}</span>
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <Link
                href="/music/catalog"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-sm border border-white/10"
              >
                <ArrowLeft className="w-4 h-4" />
                {tx('回音樂庫', '回音乐库', 'Back to catalog')}
              </Link>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400"
              >
                {tx('首頁', '首页', 'Home')}
              </Link>
            </div>
          </div>
        </section>
        <Footer />
      </main>
    );
  }

  // ---- Brief form -------------------------------------------------------
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="pt-28 pb-8 px-4">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/music/catalog"
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition mb-6"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {tx('回音樂庫', '回音乐库', 'Back to catalog')}
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {tx('音樂製作 Brief', '音乐制作 Brief', 'Music Production Brief')}
          </h1>
          <p className="text-gray-400">
            {tx(
              '送出後 1 個工作日內回覆報價與製作時程。完整商業授權，2-5 輪修改(依等級而定)。',
              '送出后 1 个工作日内回复报价与制作时程。完整商业授权，2-5 轮修改(依等级而定)。',
              'We respond with a quote and timeline within 1 business day. Full commercial license, 2-5 revision rounds depending on tier.'
            )}
          </p>
        </div>
      </section>

      {/* Offer Tier 1 fast-track if user picked AI Curator. AI Curator is
          standardized enough that a brief + 24h wait is overkill — direct
          checkout is the better path for this segment. */}
      {tier === 'ai-curator' && (
        <section className="px-4 mb-6">
          <div className="max-w-3xl mx-auto p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/30 flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-300">
              {tx(
                '💡 Tier 1 AI Curator 可以跳過 brief 直接結帳，24-48 小時交件。',
                '💡 Tier 1 AI Curator 可以跳过 brief 直接结账，24-48 小时交件。',
                '💡 Tier 1 AI Curator can skip the brief and check out directly — 24-48 hour delivery.'
              )}
            </span>
            <Link
              href={`/music/create?tier=ai-curator${trackSlug ? `&track=${trackSlug}&trackTitle=${encodeURIComponent(trackTitle)}` : ''}`}
              className="shrink-0 px-3 py-1.5 rounded-full bg-cyan-500 text-black text-xs font-semibold hover:bg-cyan-400 transition"
            >
              {tx('直接結帳 →', '直接结账 →', 'Direct checkout →')}
            </Link>
          </div>
        </section>
      )}

      {/* Selected track preview */}
      {trackSlug && (
        <section className="px-4 mb-8">
          <div className="max-w-3xl mx-auto p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-pink-500/10 border border-amber-500/30 flex items-center gap-4">
            <div className="relative shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-zinc-800">
              <img
                src={`${STORAGE_BASE}/${trackSlug}.jpg`}
                alt={trackTitle || trackSlug}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
              {playing && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-amber-400 uppercase tracking-widest font-semibold mb-0.5">
                {tx('你挑的起點曲目', '你挑的起点曲目', 'Your starting-point track')}
              </p>
              <p className="text-base font-semibold truncate">{trackTitle || trackSlug}</p>
              {trackSubtitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{trackSubtitle}</p>}
              {playing && (
                <div className="mt-1.5 h-0.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-[width] duration-150 ease-linear"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
              )}
            </div>
            {trackAudioUrl && (
              <button
                type="button"
                onClick={togglePlay}
                className="shrink-0 w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition shadow-md"
                aria-label={playing ? 'Pause' : 'Play'}
              >
                {playing ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4 ml-0.5" fill="currentColor" />}
              </button>
            )}
          </div>
        </section>
      )}

      {!trackSlug && (
        <section className="px-4 mb-8">
          <div className="max-w-3xl mx-auto p-4 rounded-2xl bg-white/5 border border-white/10 text-sm text-gray-400 flex items-center gap-3">
            <Music className="w-5 h-5 text-amber-400 shrink-0" />
            <span>
              {tx('尚未挑選起點曲目?', '尚未挑选起点曲目?', 'No starting-point track yet?')}{' '}
              <Link href="/music/catalog" className="text-amber-400 underline hover:text-amber-300">
                {tx('回音樂庫挑一首', '回音乐库挑一首', 'Pick one from the catalog')}
              </Link>
              {' '}{tx('(可選)', '(可选)', '(optional)')}
            </span>
          </div>
        </section>
      )}

      {/* The form */}
      <section className="px-4 pb-24">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-10">

          {/* SECTION 1: Production tier (cards) */}
          <Section
            num="1"
            title={tx('製作等級', '制作等级', 'Production tier')}
            required
            hint={tx(
              'AI 生成、真人製作、或完整版權買斷。不確定的話選「請建議我」，Onyx 看完 brief 後幫你判斷。',
              'AI 生成、真人制作、或完整版权买断。不确定的话选「请建议我」，Onyx 看完 brief 后帮你判断。',
              "AI generation, human producer, or full copyright buyout. Not sure? Pick 'Recommend for me' and Onyx will advise after reviewing your brief."
            )}
          >
            <div className="grid sm:grid-cols-2 gap-3">
              {TIER_CARDS.map(card => {
                const Icon = card.icon;
                const active = tier === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setTier(card.id)}
                    className={`relative text-left p-4 rounded-xl border transition ${
                      active
                        ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30'
                        : 'border-white/10 bg-white/5 hover:border-white/30'
                    }`}
                  >
                    {card.popular && (
                      <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-cyan-500 text-black text-[9px] font-bold uppercase tracking-wider">
                        {tx('最熱門', '最热门', 'Most Popular')}
                      </span>
                    )}
                    <div className="flex items-start gap-3">
                      <div className={`shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="font-semibold text-sm">
                            {isZhCN ? card.nameCn : isZh ? card.nameTw : card.nameEn}
                          </p>
                          {card.priceLabel && (
                            <span className="text-amber-400 text-sm font-bold whitespace-nowrap">{card.priceLabel}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 leading-relaxed mt-1">
                          {isZhCN ? card.descCn : isZh ? card.descTw : card.descEn}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* SECTION 2: Strings add-on */}
          <Section
            num="2"
            title={tx('Live 弦樂(額外加購)', 'Live 弦乐(额外加购)', 'Live strings add-on')}
            hint={tx(
              '需要真實樂手錄製的弦樂?電影、廣告、品牌片常用，可疊加在任何等級上。不確定就選「請建議我」。',
              '需要真实乐手录制的弦乐?电影、广告、品牌片常用，可叠加在任何等级上。不确定就选「请建议我」。',
              "Need real string players recorded? Common for film, ads, and premium brand work. Stacks on top of any tier. Not sure? Pick 'Recommend for me'."
            )}
          >
            <div className="flex flex-wrap gap-2">
              {STRING_CARDS.map(s => {
                const active = strings === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStrings(s.id)}
                    className={`px-3 py-2 rounded-lg text-sm border transition ${
                      active
                        ? 'bg-amber-500 text-black border-amber-500 font-semibold'
                        : 'bg-white/5 text-gray-300 border-white/10 hover:border-white/30'
                    }`}
                  >
                    <span>{isZhCN ? s.nameCn : isZh ? s.nameTw : s.nameEn}</span>
                    {s.priceLabel && <span className="ml-2 text-[11px] opacity-80">{s.priceLabel}</span>}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* SECTION 3: Project specs */}
          <Section num="3" title={tx('專案規格', '项目规格', 'Project specs')} required>
            <Field label={tx('專案 / 品牌名稱', '项目 / 品牌名称', 'Project / brand name')}>
              <input
                type="text"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder={tx('例:Acme 春季廣告、Project X 主題曲(可選)',
                                '例:Acme 春季广告、Project X 主题曲(可选)',
                                'e.g., Acme Spring Ad, Project X Theme (optional)')}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-amber-500/60"
              />
            </Field>
            <Field label={tx('專案類型', '项目类型', 'Project type')} required>
              <Choices
                value={projectType}
                onSelect={(v) => setProjectType(v as ProjectType)}
                options={(['ad','trailer','podcast','corporate','game','wellness','wedding','kids','travel','seasonal','song','other'] as ProjectType[])
                  .map(k => [k, labelFor.projectType(k)] as [string, string])}
              />
            </Field>
            <Field label={tx('成品長度', '成品长度', 'Final length')} required>
              <Choices
                value={lengthBucket}
                onSelect={(v) => setLengthBucket(v as LengthBucket)}
                options={(['15s','30s','60s','90s','2min','3min','longer','custom'] as LengthBucket[])
                  .map(k => [k, labelFor.lengthBucket(k)] as [string, string])}
              />
              {lengthBucket === 'custom' && (
                <input
                  type="number"
                  value={customLength}
                  onChange={e => setCustomLength(e.target.value)}
                  placeholder={tx('秒數', '秒数', 'Seconds')}
                  className="mt-3 w-full max-w-xs px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-amber-500/60"
                />
              )}
            </Field>
            <Field label={tx('語言(可多選)', '语言(可多选)', 'Languages (multi-select)')}>
              <div className="flex flex-wrap gap-2">
                {LANGS.map(l => {
                  const active = languages.includes(l.code);
                  return (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => toggleLanguage(l.code)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition ${
                        active ? 'bg-amber-500 text-black border-amber-500'
                               : 'bg-white/5 text-gray-300 border-white/10 hover:border-white/30'
                      }`}
                    >
                      {isZhCN ? l.label.cn : isZh ? l.label.tw : l.label.en}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label={tx('使用範圍(授權)', '使用范围(授权)', 'Usage scope (license)')} required>
              <Choices
                value={usage}
                onSelect={(v) => setUsage(v as Usage)}
                options={(['web','broadcast','allMedia','unsure'] as Usage[])
                  .map(k => [k, labelFor.usage(k)] as [string, string])}
              />
            </Field>
            <Field label={tx('交期', '交期', 'Deadline')} required>
              <Choices
                value={deadline}
                onSelect={(v) => setDeadline(v as Deadline)}
                options={(['rush24h','days3','week1','weeks2','flexible'] as Deadline[])
                  .map(k => [k, labelFor.deadline(k)] as [string, string])}
              />
            </Field>
          </Section>

          {/* SECTION 4: Vocals (only if song / vocal context) */}
          {isVocalContext && (
            <Section num="4" title={tx('人聲', '人声', 'Vocals')}>
              <Field label={tx('歌詞處理', '歌词处理', 'Lyrics handling')}>
                <Choices
                  value={lyrics}
                  onSelect={(v) => setLyrics(v as Lyrics)}
                  options={(['reuseDemo','iProvide','youWrite','na'] as Lyrics[])
                    .map(k => [k, labelFor.lyrics(k)] as [string, string])}
                />
              </Field>
              <Field label={tx('人聲性別 / 編制', '人声性别 / 编制', 'Vocal gender / lineup')}>
                <Choices
                  value={vocalGender}
                  onSelect={(v) => setVocalGender(v as VocalGender)}
                  options={(['male','female','duet','group','noPref','na'] as VocalGender[])
                    .map(k => [k, labelFor.vocalGender(k)] as [string, string])}
                />
              </Field>
            </Section>
          )}

          {/* SECTION 5: Deliverables */}
          <Section
            num={isVocalContext ? '5' : '4'}
            title={tx('交付規格', '交付规格', 'Deliverables')}
            hint={tx(
              '剪輯師通常需要分軌 stems;電視廣告通常需要 15 秒、30 秒短版。',
              '剪辑师通常需要分轨 stems;电视广告通常需要 15 秒、30 秒短版。',
              'Editors usually need separated stems; TV ads usually need 15s/30s edits alongside the master.'
            )}
          >
            <div className="flex flex-wrap gap-2">
              {DELIVERABLE_OPTIONS.map(d => {
                const active = deliverables.includes(d.code);
                return (
                  <button
                    key={d.code}
                    type="button"
                    onClick={() => toggleDeliverable(d.code)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition ${
                      active ? 'bg-amber-500 text-black border-amber-500'
                             : 'bg-white/5 text-gray-300 border-white/10 hover:border-white/30'
                    }`}
                  >
                    {isZhCN ? d.label.cn : isZh ? d.label.tw : d.label.en}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* SECTION 6: Creative direction */}
          <Section
            num={isVocalContext ? '6' : '5'}
            title={tx('創意方向', '创意方向', 'Creative direction')}
            hint={tx(
              '參考曲目連結、想要的氛圍、不要的元素 — 寫得越具體，報價越精準、製作越貼近。',
              '参考曲目链接、想要的氛围、不要的元素 — 写得越具体，报价越精准、制作越贴近。',
              "Reference track URLs, the vibe you want, things to avoid — the more specific you are, the tighter the quote and the closer we'll hit."
            )}
          >
            <Field label={tx('參考曲目(連結或文字皆可)',
                              '参考曲目(链接或文字皆可)',
                              'Reference tracks (URLs or text descriptions)')}>
              <textarea
                value={referenceTracks}
                onChange={e => setReferenceTracks(e.target.value)}
                rows={3}
                placeholder={tx(
                  '一行一條，例如:\nhttps://open.spotify.com/track/...\n類似 Coldplay「Yellow」的溫暖感',
                  '一行一条，例如:\nhttps://open.spotify.com/track/...\n类似 Coldplay「Yellow」的温暖感',
                  'One per line, e.g.:\nhttps://open.spotify.com/track/...\nWarm like Coldplay "Yellow"'
                )}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-amber-500/60 resize-y font-mono"
              />
            </Field>
            <Field label={tx('不要的元素 / 風格', '不要的元素 / 风格', 'Avoid (what you DON\'T want)')}>
              <textarea
                value={avoidList}
                onChange={e => setAvoidList(e.target.value)}
                rows={2}
                placeholder={tx(
                  '例如:不要鋼琴、不要哀傷感、不要嘻哈節拍、不要太電子',
                  '例如:不要钢琴、不要哀伤感、不要嘻哈节拍、不要太电子',
                  'e.g., No piano, nothing too sad, no hip-hop beats, not too electronic'
                )}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-amber-500/60 resize-y"
              />
            </Field>
            <Field label={tx('其他補充', '其他补充', 'Other notes')}>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder={tx('品牌調性、播放情境、特殊需求…',
                                '品牌调性、播放情境、特殊需求…',
                                'Brand tone, playback context, special requirements…')}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-amber-500/60 resize-y"
              />
            </Field>
          </Section>

          {/* SECTION 7: Contact */}
          <Section num={isVocalContext ? '7' : '6'} title={tx('聯絡方式', '联络方式', 'Contact')}>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={tx('姓名', '姓名', 'Name')} required>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={tx('你的名字', '你的名字', 'Your name')}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-amber-500/60"
                />
              </Field>
              <Field label="Email" required>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-amber-500/60"
                />
              </Field>
              <Field label={tx('公司 / 品牌', '公司 / 品牌', 'Company / brand')}>
                <input
                  type="text"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  placeholder={tx('可選', '可选', 'Optional')}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-amber-500/60"
                />
              </Field>
            </div>
          </Section>

          <button
            type="submit"
            disabled={sending}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-full bg-amber-500 text-black font-semibold hover:bg-amber-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {tx('送出中…', '送出中…', 'Sending…')}</>
              : tx('送出 brief — 24 小時內回覆報價', '送出 brief — 24 小时内回复报价', 'Send brief — quote within 24 hours')
            }
          </button>
          <p className="text-center text-xs text-gray-500">
            {tx(
              '送出後 24 小時內回覆報價，接受報價才付款。',
              '送出后 24 小时内回复报价，接受报价才付款。',
              "We email a quote within 24 hours. You only pay after you accept it."
            )}
          </p>
        </form>
      </section>
      <Footer />
    </main>
  );
}

function Section({
  num,
  title,
  hint,
  required,
  children,
}: {
  num: string;
  title: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3">
        <span className="text-xs font-mono text-amber-400 w-6">{num}.</span>
        <div className="flex-1">
          <h2 className="text-lg font-bold">
            {title}
            {required && <span className="text-amber-400 ml-1">*</span>}
          </h2>
          {hint && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{hint}</p>}
        </div>
      </div>
      <div className="pl-9 space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-2">
        {label}
        {required && <span className="text-amber-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function Choices({
  value,
  options,
  onSelect,
}: {
  value: string;
  options: [string, string][];
  onSelect: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([k, label]) => {
        const active = value === k;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onSelect(k)}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${
              active ? 'bg-amber-500 text-black border-amber-500'
                     : 'bg-white/5 text-gray-300 border-white/10 hover:border-white/30'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default function MusicBriefPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <BriefPageInner />
    </Suspense>
  );
}
