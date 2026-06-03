'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter, Link } from '@/i18n/navigation';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { ArrowLeft, Music, Loader2, CreditCard, Sparkles, Waves, Zap, Briefcase, Gamepad2, Edit3, Play, Pause, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { audioManager } from '@/lib/audioManager';
import Footer from '@/components/landing/Footer';
import type { LucideIcon } from 'lucide-react';

const STORAGE_BASE = 'https://hnblwckpnapsdladcjql.supabase.co/storage/v1/object/public/music-samples/covers';

type VibeKey = 'cinematic' | 'chill' | 'epic' | 'corporate' | 'game' | 'custom';
type LengthKey = '15' | '30' | '60' | '120';
type LicenseKey = 'standard' | 'buyout';
type UsageKey =
  | 'social_media'
  | 'advertisement'
  | 'video_film'
  | 'game'
  | 'podcast'
  | 'personal'
  | 'other';

const VIBES: { key: VibeKey; icon: LucideIcon; label: string; tagline: string }[] = [
  { key: 'cinematic', icon: Sparkles, label: 'Cinematic', tagline: 'Sweeping, dramatic, orchestral' },
  { key: 'chill', icon: Waves, label: 'Chill / Lo-Fi', tagline: 'Mellow, atmospheric, lounge' },
  { key: 'epic', icon: Zap, label: 'Epic / Trailer', tagline: 'Bold, hybrid, hits hard' },
  { key: 'corporate', icon: Briefcase, label: 'Corporate', tagline: 'Clean, uplifting, motivational' },
  { key: 'game', icon: Gamepad2, label: 'Game / Action', tagline: 'Driving, energetic, looping' },
  { key: 'custom', icon: Edit3, label: 'Custom', tagline: 'Describe your own' },
];

const LENGTHS: { key: LengthKey; label: string; subtitle: string }[] = [
  { key: '15', label: '0:15', subtitle: 'Short' },
  { key: '30', label: '0:30', subtitle: 'Standard' },
  { key: '60', label: '1:00', subtitle: 'Long' },
  { key: '120', label: '2:00', subtitle: 'Extended' },
];

const USAGES: { key: UsageKey; label: string }[] = [
  { key: 'social_media', label: 'Social Media (TikTok / Reels / Shorts)' },
  { key: 'advertisement', label: 'Advertisement (TV / Online ads)' },
  { key: 'video_film', label: 'Video / Film Soundtrack' },
  { key: 'game', label: 'Game Soundtrack' },
  { key: 'podcast', label: 'Podcast Intro / Outro' },
  { key: 'personal', label: 'Personal / Hobby (lower price)' },
  { key: 'other', label: 'Other' },
];

// Pricing matrix: USD. Wing can tune.
const PRICING: Record<LengthKey, Record<LicenseKey, number>> = {
  '15':  { standard: 49,  buyout: 199 },
  '30':  { standard: 99,  buyout: 499 },
  '60':  { standard: 149, buyout: 799 },
  '120': { standard: 199, buyout: 1499 },
};

// Personal usage gets 30% off standard, buyout not available.
const PERSONAL_DISCOUNT = 0.7;

interface FormState {
  vibe: VibeKey | null;
  vibeCustom: string;
  referenceLink: string;
  length: LengthKey | null;
  usage: UsageKey | null;
  license: LicenseKey;
  notes: string;
  email: string;
}

const INITIAL_FORM: FormState = {
  vibe: null,
  vibeCustom: '',
  referenceLink: '',
  length: null,
  usage: null,
  license: 'standard',
  notes: '',
  email: '',
};

function MusicCreatePageInner() {
  const router = useRouter();
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  // Localized label maps for the configurator options. Keys stay stable
  // (drive the API payload), labels swap by locale. Order in the source
  // arrays still drives render order.
  const vibeLabel = (k: VibeKey): { label: string; tagline: string } => ({
    cinematic: { label: tx('電影感',      '电影感',      'Cinematic'),     tagline: tx('磅礴、戲劇性、管弦樂',       '磅礴、戏剧性、管弦乐',       'Sweeping, dramatic, orchestral') },
    chill:     { label: tx('慵懶 / Lo-Fi','慵懒 / Lo-Fi','Chill / Lo-Fi'), tagline: tx('輕鬆、氛圍感、Lounge',        '轻松、氛围感、Lounge',        'Mellow, atmospheric, lounge') },
    epic:      { label: tx('史詩 / 預告', '史诗 / 预告', 'Epic / Trailer'),tagline: tx('大膽、混合電子、衝擊感',     '大胆、混合电子、冲击感',     'Bold, hybrid, hits hard') },
    corporate: { label: tx('企業',         '企业',         'Corporate'),     tagline: tx('乾淨、激勵、正向',           '干净、激励、正向',           'Clean, uplifting, motivational') },
    game:      { label: tx('遊戲 / 動作', '游戏 / 动作', 'Game / Action'), tagline: tx('推進感、有能量、可循環',     '推进感、有能量、可循环',     'Driving, energetic, looping') },
    custom:    { label: tx('自訂',         '自定',         'Custom'),        tagline: tx('自己描述',                   '自己描述',                   'Describe your own') },
  }[k]);

  const lengthSubtitle = (k: LengthKey): string => ({
    '15':  tx('短',     '短',     'Short'),
    '30':  tx('標準',   '标准',   'Standard'),
    '60':  tx('長',     '长',     'Long'),
    '120': tx('加長',   '加长',   'Extended'),
  }[k]);

  const usageLabel = (k: UsageKey): string => ({
    social_media:  tx('社群媒體(TikTok / Reels / Shorts)', '社群媒体(TikTok / Reels / Shorts)', 'Social Media (TikTok / Reels / Shorts)'),
    advertisement: tx('廣告(電視 / 網路)',                 '广告(电视 / 网络)',                 'Advertisement (TV / Online ads)'),
    video_film:    tx('影片 / 電影配樂',                    '影片 / 电影配乐',                    'Video / Film Soundtrack'),
    game:          tx('遊戲配樂',                           '游戏配乐',                           'Game Soundtrack'),
    podcast:       tx('Podcast 片頭 / 片尾',                'Podcast 片头 / 片尾',                'Podcast Intro / Outro'),
    personal:      tx('個人 / 興趣用途(較低價)',           '个人 / 兴趣用途(较低价)',           'Personal / Hobby (lower price)'),
    other:         tx('其他',                                '其他',                                'Other'),
  }[k]);

  // Pick up ?track= and ?trackTitle= from the catalog so we can show the
  // user the reference track they chose. The slot_key drives both the
  // audio playback (looked up against audio_showcases) and the cover
  // image URL (predictable path under music-samples/covers/).
  const searchParams = useSearchParams();
  const trackSlug = searchParams.get('track') || '';
  const trackTitle = searchParams.get('trackTitle') || '';

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [emailPrefilled, setEmailPrefilled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Preview state for the picked reference track.
  const [trackAudioUrl, setTrackAudioUrl] = useState('');
  const [trackPlaying, setTrackPlaying] = useState(false);
  const [trackAudio, setTrackAudio] = useState<HTMLAudioElement | null>(null);

  // Prefill email from auth session if logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setForm((f) => (f.email ? f : { ...f, email: session.user.email || '' }));
        setEmailPrefilled(Boolean(session.user.email));
      }
    });
  }, []);

  // Load the picked track's audio_url so the user can preview the reference
  // they brought from the catalog. Also seed the form's reference_link
  // field with the slot_key so the producer can identify it later.
  useEffect(() => {
    if (!trackSlug) return;
    supabase
      .from('audio_showcases')
      .select('audio_url')
      .eq('section', 'music_library')
      .eq('slot_key', trackSlug)
      .single()
      .then(({ data }) => {
        if (data?.audio_url) setTrackAudioUrl(data.audio_url);
      });
    // Seed reference_link with a human-readable handle so the producer
    // sees "catalog:Spark Up (brand-sting-1)" in the order. Don't
    // overwrite if the user has already typed something.
    setForm(f => f.referenceLink
      ? f
      : { ...f, referenceLink: `catalog:${trackTitle || trackSlug} (${trackSlug})` }
    );
    return () => {
      if (trackAudio) {
        trackAudio.pause();
        audioManager.stop(trackAudio);
      }
    };
  }, [trackSlug, trackTitle]);

  const toggleTrackPlay = () => {
    if (!trackAudioUrl) return;
    if (trackPlaying) {
      trackAudio?.pause();
      if (trackAudio) audioManager.stop(trackAudio);
      setTrackPlaying(false);
      return;
    }
    let a = trackAudio;
    if (!a) {
      a = new Audio(trackAudioUrl);
      a.onended = () => setTrackPlaying(false);
      setTrackAudio(a);
    }
    audioManager.play(a, () => setTrackPlaying(false));
    a.play();
    setTrackPlaying(true);
  };

  const isPersonal = form.usage === 'personal';
  const effectiveLicense: LicenseKey = isPersonal ? 'standard' : form.license;

  const price = useMemo(() => {
    if (!form.length) return 0;
    const base = PRICING[form.length][effectiveLicense];
    return isPersonal ? Math.round(base * PERSONAL_DISCOUNT) : base;
  }, [form.length, effectiveLicense, isPersonal]);

  const canSubmit =
    !!form.email.trim() &&
    !!form.vibe &&
    (form.vibe !== 'custom' || form.vibeCustom.trim().length > 0) &&
    !!form.length &&
    !!form.usage &&
    price > 0;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setError('');
  }

  async function handleSubmit() {
    if (!canSubmit) {
      setError(tx('請填妥所有必填欄位', '请填妥所有必填栏位', 'Please fill all required fields'));
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const orderNumber = `MO-${Date.now()}`;
      // Use the localized labels in the order payload so the producer
      // sees the same vibe / usage descriptors the customer picked.
      const vibeForPayload =
        form.vibe === 'custom'
          ? form.vibeCustom
          : form.vibe ? vibeLabel(form.vibe).label : '';
      const usageForPayload = form.usage ? usageLabel(form.usage) : '';

      const description = [
        `Length: ${form.length}s`,
        `License: ${effectiveLicense}`,
        form.notes ? `Notes: ${form.notes}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      // 1. Create music order in DB
      const orderRes = await fetch('/api/orders/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          project_name: null,
          vibe: vibeForPayload,
          reference_link: form.referenceLink,
          usage_type: usageForPayload,
          description,
          tier: 'ai-curator',
          price,
          status: 'pending_payment',
          payment_status: 'pending',
          order_number: orderNumber,
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Failed to create order');

      const orderId = orderData.id;

      // 2. Kick off Paddle hosted checkout
      const checkoutRes = await fetch('/api/payment/paddle/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          billingDetails: { email: form.email },
          successUrl: `${window.location.origin}/checkout/success?id=${orderId}`,
        }),
      });

      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok) throw new Error(checkoutData.error || 'Failed to create checkout');

      window.location.href = checkoutData.checkoutUrl;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tx('發生錯誤，請稍後再試', '发生错误，请稍后再试', 'Something went wrong'));
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white pt-28 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => router.push('/music')}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {tx('回音樂工作室', '回音乐工作室', 'Back to Music')}
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium mb-4">
            <Music className="w-3.5 h-3.5" />
            {tx('新 AI 音樂專案', '新 AI 音乐项目', 'New AI Music Project')}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-white via-emerald-100 to-white bg-clip-text text-transparent">
            {tx('告訴我們你的 vibe。', '告诉我们你的 vibe。', 'Tell us your vibe.')}
          </h1>
          <p className="text-gray-400 text-lg">
            {tx(
              '製作人精選 + 加層 + 重新混音。網路與社群使用授權，48-72 小時交件。',
              '制作人精选 + 加层 + 重新混音。网络与社群使用授权，48-72 小时交件。',
              'Producer-curated, layered, remixed. Web & social license. 48-72 hour delivery.'
            )}
          </p>
        </motion.div>

        {/* Reference track the user picked from the catalog. Shown as a
            preview card with audio playback so they can re-validate the
            choice while filling out the configurator. The slot_key is
            already seeded into form.referenceLink so the producer gets
            it on the order. */}
        {trackSlug && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-pink-500/10 border border-amber-500/30 flex items-center gap-3">
            <div className="relative shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-zinc-800">
              <img
                src={`${STORAGE_BASE}/${trackSlug}.jpg`}
                alt={trackTitle || trackSlug}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
              {trackPlaying && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-amber-400 uppercase tracking-widest font-semibold">
                {tx('起點曲目參考', '起点曲目参考', 'Starting reference')}
              </p>
              <p className="text-sm font-semibold truncate">{trackTitle || trackSlug}</p>
              <p className="text-[11px] text-gray-500 truncate">{trackSlug}</p>
            </div>
            {trackAudioUrl && (
              <button
                type="button"
                onClick={toggleTrackPlay}
                className="shrink-0 w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition shadow-md"
                aria-label={trackPlaying ? 'Pause' : 'Play'}
              >
                {trackPlaying ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4 ml-0.5" fill="currentColor" />}
              </button>
            )}
          </div>
        )}

        {/* Pointer to the brief flow for users who realize Tier 1 isn't
            enough. Better to offer the off-ramp here than have them check
            out at the wrong tier and request a refund later. */}
        <div className="mb-8 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 text-gray-300">
            <FileText className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              {tx(
                '需要真人製作或 Live 弦樂?',
                '需要真人制作或 Live 弦乐?',
                'Need a human producer or live strings?'
              )}
            </span>
          </div>
          <Link
            href={`/music/brief${trackSlug ? `?track=${trackSlug}&trackTitle=${encodeURIComponent(trackTitle)}` : ''}`}
            className="shrink-0 px-3 py-1.5 rounded-full bg-amber-500 text-black text-xs font-semibold hover:bg-amber-400 transition"
          >
            {tx('送出詢價 →', '送出询价 →', 'Send brief →')}
          </Link>
        </div>

        {/* Email */}
        <Section title={tx('你的 Email', '你的 Email', 'Your email')} required>
          <input
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            disabled={emailPrefilled}
            placeholder="you@company.com"
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-gray-600 focus:border-emerald-500/50 focus:outline-none transition-colors disabled:opacity-60"
          />
          {emailPrefilled && (
            <p className="text-xs text-gray-500 mt-2">
              {tx('目前登入：', '目前登入：', 'Logged in as ')}{form.email}
            </p>
          )}
        </Section>

        {/* Vibe */}
        <Section title={tx('風格 / 氛圍', '风格 / 氛围', 'Vibe / Style')} required>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {VIBES.map(({ key, icon: Icon }) => {
              const active = form.vibe === key;
              const { label, tagline } = vibeLabel(key);
              return (
                <button
                  key={key}
                  onClick={() => update('vibe', key)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    active
                      ? 'border-emerald-500/60 bg-emerald-500/10'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-2 ${active ? 'text-emerald-300' : 'text-gray-400'}`} />
                  <div className={`font-semibold text-sm ${active ? 'text-white' : 'text-gray-200'}`}>
                    {label}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 leading-snug">{tagline}</div>
                </button>
              );
            })}
          </div>

          {form.vibe === 'custom' && (
            <textarea
              value={form.vibeCustom}
              onChange={(e) => update('vibeCustom', e.target.value)}
              placeholder={tx('描述你想要的風格…', '描述你想要的风格…', 'Describe the vibe you want...')}
              rows={2}
              className="w-full mt-3 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:border-emerald-500/50 focus:outline-none resize-y"
            />
          )}

          <input
            type="url"
            value={form.referenceLink}
            onChange={(e) => update('referenceLink', e.target.value)}
            placeholder={tx(
              '參考連結(Spotify / YouTube，可選)',
              '参考链接(Spotify / YouTube，可选)',
              'Optional: Spotify / YouTube reference link'
            )}
            className="w-full mt-3 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:border-emerald-500/50 focus:outline-none text-sm"
          />
        </Section>

        {/* Length */}
        <Section title={tx('成品長度', '成品长度', 'Length')} required>
          <div className="grid grid-cols-4 gap-3">
            {LENGTHS.map(({ key, label }) => {
              const active = form.length === key;
              return (
                <button
                  key={key}
                  onClick={() => update('length', key)}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${
                    active
                      ? 'border-emerald-500/60 bg-emerald-500/10'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className={`font-bold text-lg ${active ? 'text-white' : 'text-gray-200'}`}>
                    {label}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{lengthSubtitle(key)}</div>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Usage */}
        <Section title={tx('用途', '用途', 'Usage')} required>
          <select
            value={form.usage || ''}
            onChange={(e) => update('usage', e.target.value as UsageKey)}
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3.5 text-white focus:border-emerald-500/50 focus:outline-none transition-colors"
          >
            <option value="" disabled className="bg-[#050505]">
              {tx('選擇用途…', '选择用途…', 'Select usage...')}
            </option>
            {USAGES.map(({ key }) => (
              <option key={key} value={key} className="bg-[#050505]">
                {usageLabel(key)}
              </option>
            ))}
          </select>
        </Section>

        {/* License */}
        <Section title={tx('授權方式', '授权方式', 'License')} required>
          {isPersonal ? (
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <p className="text-sm text-amber-300">
                {tx(
                  '個人非商業用途 — 自動套用 1 年標準授權，享 7 折優惠。',
                  '个人非商业用途 — 自动套用 1 年标准授权，享 7 折优惠。',
                  'Personal use only — non-commercial. Standard 1-year license auto-applied at 30% discount.'
                )}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(['standard', 'buyout'] as LicenseKey[]).map((key) => {
                const active = form.license === key;
                const label = key === 'standard'
                  ? tx('標準授權', '标准授权', 'Standard')
                  : tx('完整買斷', '完整买断', 'Buyout');
                const desc = key === 'standard'
                  ? tx('1 年期，網路 / 社群 / 自家品牌使用',
                       '1 年期，网络 / 社群 / 自家品牌使用',
                       '1 year, web/social/your brand')
                  : tx('永久授權，版權完整移轉，你完全擁有',
                       '永久授权，版权完整移转，你完全拥有',
                       'Permanent, full IP transfer, you own everything');
                return (
                  <button
                    key={key}
                    onClick={() => update('license', key)}
                    className={`p-5 rounded-xl border-2 text-left transition-all ${
                      active
                        ? 'border-emerald-500/60 bg-emerald-500/10'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className={`font-semibold text-base mb-1 ${active ? 'text-white' : 'text-gray-200'}`}>
                      {label}
                    </div>
                    <div className="text-xs text-gray-400 leading-relaxed">{desc}</div>
                  </button>
                );
              })}
            </div>
          )}
        </Section>

        {/* Notes */}
        <Section title={tx('專案備註(可選)', '项目备注(可选)', 'Project notes (optional)')}>
          <textarea
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder={tx(
              '氛圍、樂器、使用情境、交期…',
              '氛围、乐器、使用情境、交期…',
              'Mood, instruments, scene context, deadline...'
            )}
            rows={3}
            className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:border-emerald-500/50 focus:outline-none resize-y"
          />
        </Section>

        {/* Total + Submit */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-10 p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent border border-emerald-500/20"
        >
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-sm text-gray-400 uppercase tracking-wider">
              {tx('總計', '总计', 'Total')}
            </span>
            <span className="text-4xl font-bold text-white">
              {price > 0 ? `US$${price}` : '—'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-6">
            {tx(
              '預計交件：付款後 24-48 小時',
              '预计交件：付款后 24-48 小时',
              'Estimated delivery: 24–48 hours after payment'
            )}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {tx('建立訂單中…', '建立订单中…', 'Creating order...')}
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                {tx('前往結帳', '前往结账', 'Continue to Checkout')}
              </>
            )}
          </button>
        </motion.div>
      </div>

      <Footer />
    </main>
  );
}

function Section({
  title,
  required,
  children,
}: {
  title: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="mt-8"
    >
      <label className="block text-sm font-medium text-gray-300 mb-3">
        {title}
        {required && <span className="text-emerald-400 ml-1">*</span>}
      </label>
      {children}
    </motion.div>
  );
}

// useSearchParams() needs a Suspense boundary in App Router builds, even
// inside a 'use client' tree. Splitting the page into an inner component
// + a wrapping default export keeps the static-prerender path happy.
export default function MusicCreatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
      <MusicCreatePageInner />
    </Suspense>
  );
}
