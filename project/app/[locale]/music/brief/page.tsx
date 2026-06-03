'use client';

/**
 * /music/brief — dedicated music-production brief form.
 *
 * Flow: /music/catalog → user picks a track ("Use this →") →
 * /music/brief?track=<slot_key>&trackTitle=<title> → user fills
 * structured fields → POST /api/contact/send with formatted message
 * + department=PRODUCTION → 24h human-reviewed quote follows by email.
 *
 * This sits between catalog browsing and checkout. Direct checkout
 * doesn't work for bespoke music production because the price depends
 * on length/language/usage/deadline/lyrics-rewriting/revisions — see
 * MusicBed / Marmoset / Audio Network for the same inquiry-first
 * pattern at this price point ($229+ per project).
 */

import { useState, useEffect, useRef, FormEvent, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Play, Pause, Loader2, CheckCircle2, ArrowLeft, Music } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { audioManager } from '@/lib/audioManager';
import Footer from '@/components/landing/Footer';

const STORAGE_BASE = 'https://hnblwckpnapsdladcjql.supabase.co/storage/v1/object/public/music-samples/covers';

type ProjectType = 'ad' | 'trailer' | 'podcast' | 'corporate' | 'game' | 'wellness' | 'wedding' | 'kids' | 'travel' | 'seasonal' | 'song' | 'other';
type LengthBucket = '15s' | '30s' | '60s' | '90s' | '2min' | '3min' | 'longer' | 'custom';
type Usage = 'web' | 'broadcast' | 'allMedia' | 'unsure';
type Deadline = 'rush24h' | 'days3' | 'week1' | 'weeks2' | 'flexible';
type Lyrics = 'reuseDemo' | 'iProvide' | 'youWrite' | 'na';
type Budget = 'tier1' | 'tier2' | 'tier3' | 'discuss';

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

function BriefPageInner() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  const searchParams = useSearchParams();
  const trackSlug = searchParams.get('track') || '';
  const trackTitle = searchParams.get('trackTitle') || '';

  const [trackAudioUrl, setTrackAudioUrl] = useState('');
  const [trackSubtitle, setTrackSubtitle] = useState('');
  const [playing, setPlaying] = useState(false);
  // Same Bandcamp-style progress (0..1) as the catalog page.
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [projectType, setProjectType] = useState<ProjectType | ''>('');
  const [lengthBucket, setLengthBucket] = useState<LengthBucket | ''>('');
  const [customLength, setCustomLength] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [usage, setUsage] = useState<Usage | ''>('');
  const [deadline, setDeadline] = useState<Deadline | ''>('');
  const [lyrics, setLyrics] = useState<Lyrics | ''>('');
  const [budget, setBudget] = useState<Budget | ''>('');
  const [notes, setNotes] = useState('');

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [inquiryNumber, setInquiryNumber] = useState('');

  // Pull the picked track's audio_url + subtitle from Supabase so we
  // can let the user replay it on this page (validates the pick).
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

  // Render-friendly labels for the values the user picked. Same locale
  // logic as the form options — keeps the email body readable for the
  // producer who reviews it.
  const labelFor = {
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
      web:        tx('網路 only(社群、官網、YouTube)', '网络 only(社群、官网、YouTube)', 'Web only (social, site, YouTube)'),
      broadcast:  tx('電視 + 網路',                       '电视 + 网络',                       'Broadcast + Web'),
      allMedia:   tx('全媒體商業授權',                     '全媒体商业授权',                     'All-media commercial license'),
      unsure:     tx('還在評估,需要建議',                   '还在评估,需要建议',                   'Not sure yet — advise me'),
    }[k]),
    deadline: (k: Deadline): string => ({
      rush24h:  tx('24 小時加急', '24 小时加急', '24h rush'),
      days3:    tx('3 天內',      '3 天内',      'Within 3 days'),
      week1:    tx('1 週內',      '1 周内',      'Within 1 week'),
      weeks2:   tx('2 週內',      '2 周内',      'Within 2 weeks'),
      flexible: tx('彈性',        '弹性',        'Flexible'),
    }[k]),
    lyrics: (k: Lyrics): string => ({
      reuseDemo: tx('用 demo 原詞為基礎,小幅調整', '用 demo 原词为基础,小幅调整', "Reuse demo lyrics with minor tweaks"),
      iProvide:  tx('我提供完整歌詞',                '我提供完整歌词',                'I will provide full lyrics'),
      youWrite:  tx('幫我重寫(說明主題即可)',      '帮我重写(说明主题即可)',      'You write new lyrics (I describe the theme)'),
      na:        tx('不適用(純配樂)',              '不适用(纯配乐)',              'N/A (instrumental only)'),
    }[k]),
    budget: (k: Budget): string => ({
      tier1:   'US$229 - $500',
      tier2:   'US$500 - $1,500',
      tier3:   'US$1,500+',
      discuss: tx('再討論', '再讨论', "Let's discuss"),
    }[k]),
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
    if (!projectType || !lengthBucket || !usage || !deadline) {
      toast.error(tx(
        '請填專案類型 / 長度 / 用途 / 交期',
        '请填项目类型 / 长度 / 用途 / 交期',
        'Please pick project type, length, usage, and deadline'
      ));
      return;
    }
    if (lengthBucket === 'custom' && !customLength.trim()) {
      toast.error(tx('請填自訂長度(秒)', '请填自定长度(秒)', 'Please enter custom length (seconds)'));
      return;
    }

    // Build a readable message body for the producer's email. Each
    // field gets a labelled line — keeps the inbox view skimmable.
    const lines: string[] = [];
    lines.push(tx('=== 音樂製作 Brief ===', '=== 音乐制作 Brief ===', '=== Music Production Brief ==='));
    lines.push('');
    if (trackSlug) {
      const titleLabel = trackTitle || trackSlug;
      lines.push(tx('挑選曲目: ', '挑选曲目: ', 'Selected track: ') + `${titleLabel} (${trackSlug})`);
    }
    lines.push((tx('專案類型: ', '项目类型: ', 'Project type: ')) + labelFor.projectType(projectType));
    lines.push((tx('需要長度: ', '需要长度: ', 'Length: ')) + labelFor.lengthBucket(lengthBucket));
    if (languages.length) {
      const langNames = languages.map(c => {
        const item = LANGS.find(l => l.code === c);
        return item ? (isZhCN ? item.label.cn : isZh ? item.label.tw : item.label.en) : c;
      });
      lines.push((tx('語言: ', '语言: ', 'Languages: ')) + langNames.join(', '));
    }
    lines.push((tx('用途: ', '用途: ', 'Usage: ')) + labelFor.usage(usage));
    lines.push((tx('交期: ', '交期: ', 'Deadline: ')) + labelFor.deadline(deadline));
    if (lyrics) lines.push((tx('歌詞處理: ', '歌词处理: ', 'Lyrics: ')) + labelFor.lyrics(lyrics));
    if (budget) lines.push((tx('預算範圍: ', '预算范围: ', 'Budget: ')) + labelFor.budget(budget));
    if (company.trim()) lines.push((tx('公司: ', '公司: ', 'Company: ')) + company.trim());
    if (notes.trim()) {
      lines.push('');
      lines.push(tx('--- 補充說明 ---', '--- 补充说明 ---', '--- Additional notes ---'));
      lines.push(notes.trim());
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
        '送出失敗,請稍後再試或寫信到 produce@onyxstudios.ai',
        '送出失败,请稍后再试或写信到 produce@onyxstudios.ai',
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
              {tx('收到你的 brief!', '收到你的 brief!', "We've got your brief!")}
            </h1>
            <p className="text-gray-400 mb-6">
              {tx(
                '我們的製作團隊會在 1 個工作日內 email 回覆報價 + 製作時程。',
                '我们的制作团队会在 1 个工作日内 email 回复报价 + 制作时程。',
                'Our production team will email you a quote + timeline within 1 business day.'
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
              '送出後 1 個工作日內回覆報價。涵蓋 2 輪修改、完整商業授權。',
              '送出后 1 个工作日内回复报价。涵盖 2 轮修改、完整商业授权。',
              'We respond with a quote within 1 business day. Includes 2 revision rounds + full commercial license.'
            )}
          </p>
        </div>
      </section>

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
              {/* Mini progress under title when playing */}
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
              {tx(
                '尚未挑選起點曲目?',
                '尚未挑选起点曲目?',
                'No starting-point track yet?'
              )}{' '}
              <Link href="/music/catalog" className="text-amber-400 underline hover:text-amber-300">
                {tx('回音樂庫挑一首', '回音乐库挑一首', 'Pick one from the catalog')}
              </Link>
              {' '}{tx('(可選,直接填表單也行)', '(可选,直接填表单也行)', '(optional — you can also fill the form without one)')}
            </span>
          </div>
        </section>
      )}

      {/* The form */}
      <section className="px-4 pb-24">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-8">
          {/* Project type */}
          <Field label={tx('專案類型', '项目类型', 'Project type')} required>
            <Choices
              value={projectType}
              onSelect={(v) => setProjectType(v as ProjectType)}
              options={[
                ['ad',        labelFor.projectType('ad')],
                ['trailer',   labelFor.projectType('trailer')],
                ['podcast',   labelFor.projectType('podcast')],
                ['corporate', labelFor.projectType('corporate')],
                ['game',      labelFor.projectType('game')],
                ['wellness',  labelFor.projectType('wellness')],
                ['wedding',   labelFor.projectType('wedding')],
                ['kids',      labelFor.projectType('kids')],
                ['travel',    labelFor.projectType('travel')],
                ['seasonal',  labelFor.projectType('seasonal')],
                ['song',      labelFor.projectType('song')],
                ['other',     labelFor.projectType('other')],
              ]}
            />
          </Field>

          {/* Length */}
          <Field label={tx('需要長度', '需要长度', 'Length needed')} required>
            <Choices
              value={lengthBucket}
              onSelect={(v) => setLengthBucket(v as LengthBucket)}
              options={(['15s','30s','60s','90s','2min','3min','longer','custom'] as LengthBucket[]).map(k =>
                [k, labelFor.lengthBucket(k)] as [string, string]
              )}
            />
            {lengthBucket === 'custom' && (
              <input
                type="number"
                value={customLength}
                onChange={e => setCustomLength(e.target.value)}
                placeholder={tx('長度(秒)', '长度(秒)', 'Length (seconds)')}
                className="mt-3 w-full max-w-xs px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-amber-500/60"
              />
            )}
          </Field>

          {/* Languages */}
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
                      active
                        ? 'bg-amber-500 text-black border-amber-500'
                        : 'bg-white/5 text-gray-300 border-white/10 hover:border-white/30'
                    }`}
                  >
                    {isZhCN ? l.label.cn : isZh ? l.label.tw : l.label.en}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Usage scope */}
          <Field label={tx('用途 / 授權範圍', '用途 / 授权范围', 'Usage / license scope')} required>
            <Choices
              value={usage}
              onSelect={(v) => setUsage(v as Usage)}
              options={(['web','broadcast','allMedia','unsure'] as Usage[]).map(k => [k, labelFor.usage(k)] as [string, string])}
            />
          </Field>

          {/* Deadline */}
          <Field label={tx('交期', '交期', 'Deadline')} required>
            <Choices
              value={deadline}
              onSelect={(v) => setDeadline(v as Deadline)}
              options={(['rush24h','days3','week1','weeks2','flexible'] as Deadline[]).map(k => [k, labelFor.deadline(k)] as [string, string])}
            />
          </Field>

          {/* Lyrics (only show if a vocal track is picked OR project type = song) */}
          {(projectType === 'song' || trackSlug.includes('-en') || trackSlug.includes('-cn')) && (
            <Field label={tx('歌詞處理', '歌词处理', 'Lyrics handling')}>
              <Choices
                value={lyrics}
                onSelect={(v) => setLyrics(v as Lyrics)}
                options={(['reuseDemo','iProvide','youWrite','na'] as Lyrics[]).map(k => [k, labelFor.lyrics(k)] as [string, string])}
              />
            </Field>
          )}

          {/* Budget */}
          <Field label={tx('預算範圍', '预算范围', 'Budget range')}>
            <Choices
              value={budget}
              onSelect={(v) => setBudget(v as Budget)}
              options={(['tier1','tier2','tier3','discuss'] as Budget[]).map(k => [k, labelFor.budget(k)] as [string, string])}
            />
            <p className="text-xs text-gray-500 mt-2">
              {tx(
                '※ 報價依長度 / 語言 / 用途調整,$229 為單曲基礎起價。',
                '※ 报价依长度 / 语言 / 用途调整,$229 为单曲基础起价。',
                '※ Final quote depends on length / language / usage. $229 is the base per-track starting price.'
              )}
            </p>
          </Field>

          {/* Notes */}
          <Field label={tx('補充說明', '补充说明', 'Additional notes')}>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={5}
              placeholder={tx(
                '參考曲目、品牌調性、希望的人聲性別、避免的元素…(可選)',
                '参考曲目、品牌调性、希望的人声性别、避免的元素…(可选)',
                'Reference tracks, brand tone, preferred vocal gender, things to avoid… (optional)'
              )}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-amber-500/60 resize-y"
            />
          </Field>

          {/* Contact */}
          <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-white/10">
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

          <button
            type="submit"
            disabled={sending}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-full bg-amber-500 text-black font-semibold hover:bg-amber-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {tx('送出中…', '送出中…', 'Sending…')}</>
              : tx('送出 brief — 24 小時內回覆報價', '送出 brief — 24 小时内回复报价', 'Send brief — quote within 24h')
            }
          </button>
          <p className="text-center text-xs text-gray-500">
            {tx(
              '送出代表同意我們以此 brief 為基礎準備報價。報價接受後才付款。',
              '送出代表同意我们以此 brief 为基础准备报价。报价接受后才付款。',
              'Submitting authorizes us to prepare a quote based on this brief. Payment only after you accept the quote.'
            )}
          </p>
        </form>
      </section>
      <Footer />
    </main>
  );
}

// Field: label wrapper used by every form section.
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
      <label className="block text-sm font-semibold mb-3">
        {label}
        {required && <span className="text-amber-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

// Choices: pill-style radio group. Single-select.
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
              active
                ? 'bg-amber-500 text-black border-amber-500'
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
  // useSearchParams requires Suspense boundary in App Router.
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <BriefPageInner />
    </Suspense>
  );
}
