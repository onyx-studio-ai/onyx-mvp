'use client';

/**
 * /dubbing/brief — dedicated dubbing project intake form.
 *
 * Flow: /dubbing → "Send your dubbing brief" CTA → this form → POST to
 * /api/contact/send (department=PRODUCTION, source=dubbing-brief) →
 * producer emails quote within 24h.
 *
 * Why a dedicated form (not /contact): dubbing projects need
 * source/target languages, video, lip-sync mode, scope, timeline up
 * front. Capturing these structurally lets the producer respond with a
 * real quote on the first reply instead of doing 3-4 rounds of follow-
 * up emails. Same inquiry-first pattern as /music/brief.
 */

import { useState, FormEvent } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Footer from '@/components/landing/Footer';

type LipsyncMode = 'full' | 'voiceover' | 'loose';

// Voice approach drives the production pipeline:
//   preserve = RVC clone of original talent's voice to new language
//              (NEEDS CONSENT — show consent section conditionally)
//   newAI    = fresh AI-generated voices
//   human    = real-talent dubbing via Onyx roster (separate quote)
type VoiceApproach = 'preserve' | 'newAI' | 'human';

// Only required when voiceApproach === 'preserve'. All three paths shift
// the cloning-authorization liability away from Onyx onto the client.
type ConsentMode = 'have' | 'needTemplate' | 'attest';

// Script-status replaces the binary "has AI draft?" — three concrete
// pricing tiers from cheapest (already proofread) to most-work (full).
type ScriptStatus = 'fullScript' | 'aiDraft' | 'fromScratch';

// Source-material checklist — directly affects difficulty and price.
// "finishedOnly" is the worst case (no stems → separation + remix).
type Material = 'sourceVideo' | 'vocalStem' | 'musicStem' | 'sfxStem' | 'osVersion' | 'finishedOnly';

type UseCase =
  | 'film' | 'tvSeries' | 'shortDrama' | 'documentary' | 'animation'
  | 'game' | 'brand' | 'elearning' | 'podcast' | 'other';

type Timeline = 'rush' | 'standard' | 'flexible';

const LANGS = [
  { code: 'en-US', label: { tw: '英文（美）', cn: '英文（美）', en: 'English (US)' } },
  { code: 'en-UK', label: { tw: '英文（英）', cn: '英文（英）', en: 'English (UK)' } },
  { code: 'zh-TW', label: { tw: '繁體中文', cn: '繁体中文', en: 'Chinese (Traditional)' } },
  { code: 'zh-CN', label: { tw: '簡體中文', cn: '简体中文', en: 'Chinese (Simplified)' } },
  { code: 'yue',   label: { tw: '粵語',     cn: '粤语',     en: 'Cantonese' } },
  { code: 'ja',    label: { tw: '日文',     cn: '日文',     en: 'Japanese' } },
  { code: 'ko',    label: { tw: '韓文',     cn: '韩文',     en: 'Korean' } },
  { code: 'es',    label: { tw: '西班牙文', cn: '西班牙文', en: 'Spanish' } },
  { code: 'fr',    label: { tw: '法文',     cn: '法文',     en: 'French' } },
  { code: 'de',    label: { tw: '德文',     cn: '德文',     en: 'German' } },
  { code: 'pt',    label: { tw: '葡萄牙文', cn: '葡萄牙文', en: 'Portuguese' } },
  { code: 'it',    label: { tw: '義大利文', cn: '意大利文', en: 'Italian' } },
  { code: 'ru',    label: { tw: '俄文',     cn: '俄文',     en: 'Russian' } },
  { code: 'ar-msa',label: { tw: '阿拉伯（MSA）', cn: '阿拉伯（MSA）', en: 'Arabic (MSA)' } },
  { code: 'ar-najdi', label: { tw: '阿拉伯（納吉迪）', cn: '阿拉伯（纳吉迪）', en: 'Arabic (Najdi)' } },
  { code: 'hi',    label: { tw: '印地語',   cn: '印地语',   en: 'Hindi' } },
  { code: 'th',    label: { tw: '泰語',     cn: '泰语',     en: 'Thai' } },
  { code: 'vi',    label: { tw: '越南語',   cn: '越南语',   en: 'Vietnamese' } },
  { code: 'id',    label: { tw: '印尼語',   cn: '印尼语',   en: 'Indonesian' } },
  { code: 'tr',    label: { tw: '土耳其文', cn: '土耳其文', en: 'Turkish' } },
  { code: 'other', label: { tw: '其他（補充說明）', cn: '其他（补充说明）', en: 'Other (specify in notes)' } },
];

export default function DubbingBriefPage() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  // Form state
  const [sourceLanguage, setSourceLanguage] = useState('');
  const [targetLanguages, setTargetLanguages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [lipsync, setLipsync] = useState<LipsyncMode | ''>('');
  const [voiceApproach, setVoiceApproach] = useState<VoiceApproach | ''>('');
  const [consentMode, setConsentMode] = useState<ConsentMode | ''>('');
  const [scriptStatus, setScriptStatus] = useState<ScriptStatus | ''>('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [durationMinutes, setDurationMinutes] = useState('');
  const [episodes, setEpisodes] = useState('');
  const [characters, setCharacters] = useState('');
  const [useCase, setUseCase] = useState<UseCase | ''>('');
  const [timeline, setTimeline] = useState<Timeline | ''>('');
  const [references, setReferences] = useState('');
  const [notes, setNotes] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');

  const needsConsent = voiceApproach === 'preserve';
  const toggleMaterial = (m: Material) => {
    setMaterials(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [inquiryNumber, setInquiryNumber] = useState('');

  const toggleLang = (code: string) => {
    setTargetLanguages(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  // Localized labels for the picked values (used in producer email body).
  const labelFor = {
    lang: (code: string): string => {
      const item = LANGS.find(l => l.code === code);
      if (!item) return code;
      return isZhCN ? item.label.cn : isZh ? item.label.tw : item.label.en;
    },
    lipsync: (m: LipsyncMode): string => ({
      full:      tx('完整對嘴（電影 / 戲劇）', '完整对嘴（电影 / 戏剧）', 'Full lip-sync (film / drama)'),
      voiceover: tx('配音 voice-over（疊在原音上）', '配音 voice-over（叠在原音上）', 'Voice-over (over original)'),
      loose:     tx('寬鬆時序（廣告 / 旁白）', '宽松时序（广告 / 旁白）', 'Loose timing (ads / narration)'),
    }[m]),
    voiceApproach: (v: VoiceApproach): string => ({
      preserve: tx('保留原聲（AI 克隆原配音員聲線到新語言 · RVC）',
                   '保留原声（AI 克隆原配音员声线到新语言 · RVC）',
                   "Preserve original voice (RVC clone of original talent into new language)"),
      newAI:    tx('AI 全新配音（生成新聲音）',
                   'AI 全新配音（生成新声音）',
                   'New AI voices (fresh AI-generated)'),
      human:    tx('真人配音員（Onyx 配音員陣容 · 獨立報價）',
                   '真人配音员（Onyx 配音员阵容 · 独立报价）',
                   'Human voice talent (Onyx roster — separately quoted)'),
    }[v]),
    consent: (c: ConsentMode): string => ({
      have:         tx('我已取得原配音員的克隆授權書',
                       '我已取得原配音员的克隆授权书',
                       "I have the original talent's cloning authorization"),
      needTemplate: tx('需要 Onyx 提供授權書範本，我會簽完上傳',
                       '需要 Onyx 提供授权书范本，我会签完上传',
                       'I need Onyx to provide the authorization template'),
      attest:       tx('我聲明已取得授權並承擔法律責任（Onyx 不負連帶責任）',
                       '我声明已取得授权并承担法律责任（Onyx 不负连带责任）',
                       'I attest I have authorization and accept all legal liability'),
    }[c]),
    scriptStatus: (s: ScriptStatus): string => ({
      fullScript:  tx('已有完整翻譯稿（專業翻譯 / 內部已校對）',
                      '已有完整翻译稿（专业翻译 / 内部已校对）',
                      'Complete pro translation script ready'),
      aiDraft:     tx('已有 AI 翻譯稿，需校對 + 真人錄製',
                      '已有 AI 翻译稿，需校对 + 真人录制',
                      'Have AI draft — needs proofread + recording'),
      fromScratch: tx('從原文翻譯 + 真人錄製（全包）',
                      '从原文翻译 + 真人录制（全包）',
                      'Translate from source + record (full package)'),
    }[s]),
    material: (m: Material): string => ({
      sourceVideo:  tx('原始影片', '原始视频', 'Source video'),
      vocalStem:    tx('純人聲分軌（vocal stem）', '纯人声分轨（vocal stem）', 'Vocal stem (clean dialogue)'),
      musicStem:    tx('音樂分軌', '音乐分轨', 'Music stem'),
      sfxStem:      tx('音效分軌', '音效分轨', 'SFX stem'),
      osVersion:    tx('OS 版本（無對白原聲）', 'OS 版本（无对白原声）', 'OS version (no dialogue)'),
      finishedOnly: tx('僅完成片（無分軌素材 · 處理較複雜）',
                       '仅完成片（无分轨素材 · 处理较复杂）',
                       'Finished master only (no stems — more complex)'),
    }[m]),
    useCase: (u: UseCase): string => ({
      film:        tx('電影',                  '电影',                  'Film'),
      tvSeries:    tx('電視劇 / 影集',         '电视剧 / 影集',         'TV series / drama'),
      shortDrama:  tx('短劇 / 短影片',         '短剧 / 短视频',         'Short drama / short-form'),
      documentary: tx('紀錄片',                '纪录片',                'Documentary'),
      animation:   tx('動畫',                  '动画',                  'Animation'),
      game:        tx('遊戲',                  '游戏',                  'Game'),
      brand:       tx('品牌廣告',              '品牌广告',              'Brand commercial'),
      elearning:   tx('e-learning / 線上課',   'e-learning / 在线课',   'e-learning / online course'),
      podcast:     tx('Podcast / 有聲書',       'Podcast / 有声书',       'Podcast / audiobook'),
      other:       tx('其他',                  '其他',                  'Other'),
    }[u]),
    timeline: (t: Timeline): string => ({
      rush:     tx('加急（3-5 天，+30% 費用）', '加急（3-5 天，+30% 费用）', 'Rush (3-5 days, +30% fee)'),
      standard: tx('標準（7-14 天）',          '标准（7-14 天）',          'Standard (7-14 days)'),
      flexible: tx('彈性',                     '弹性',                     'Flexible'),
    }[t]),
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
    if (!sourceLanguage || targetLanguages.length === 0 || !lipsync
        || !voiceApproach || !scriptStatus || !durationMinutes.trim()
        || !useCase || !timeline) {
      toast.error(tx(
        '請填原語、目標語種、對嘴需求、聲音方式、翻譯稿狀態、時長、用途、交期',
        '请填原语、目标语种、对嘴需求、声音方式、翻译稿状态、时长、用途、交期',
        'Please fill source lang, target langs, lip-sync, voice approach, script status, duration, use case, timeline'
      ));
      return;
    }
    if (needsConsent && !consentMode) {
      toast.error(tx(
        '選擇「保留原聲」必須完成 RVC 授權確認',
        '选择「保留原声」必须完成 RVC 授权确认',
        'When preserving original voice, RVC authorization must be confirmed'
      ));
      return;
    }

    // Build producer email body — labelled sections, skimmable.
    const lines: string[] = [];
    lines.push(tx('=== 配音案件需求 ===', '=== 配音项目需求 ===', '=== Dubbing Project Brief ==='));
    lines.push('');

    lines.push(tx('▎ 語言', '▎ 语言', '▎ Languages'));
    lines.push((tx('  原始語言：', '  原始语言：', '  Source: ')) + labelFor.lang(sourceLanguage));
    lines.push((tx('  目標語種：', '  目标语种：', '  Targets: ')) + targetLanguages.map(c => labelFor.lang(c)).join('、'));
    lines.push('');

    lines.push(tx('▎ 影片 / 音源', '▎ 视频 / 音源', '▎ Video / source'));
    if (videoUrl.trim()) lines.push((tx('  影片連結：', '  视频链接：', '  Video URL: ')) + videoUrl.trim());
    else lines.push(tx('  影片連結：稍後提供', '  视频链接：稍后提供', '  Video URL: to be provided later'));
    lines.push((tx('  對嘴需求：', '  对嘴需求：', '  Lip-sync: ')) + labelFor.lipsync(lipsync as LipsyncMode));
    lines.push('');

    lines.push(tx('▎ 聲音方式', '▎ 声音方式', '▎ Voice approach'));
    lines.push('  ' + labelFor.voiceApproach(voiceApproach as VoiceApproach));
    if (needsConsent && consentMode) {
      lines.push((tx('  RVC 授權：', '  RVC 授权：', '  RVC consent: ')) + labelFor.consent(consentMode as ConsentMode));
    }
    lines.push('');

    lines.push(tx('▎ 翻譯稿狀態', '▎ 翻译稿状态', '▎ Script status'));
    lines.push('  ' + labelFor.scriptStatus(scriptStatus as ScriptStatus));
    lines.push('');

    if (materials.length > 0) {
      lines.push(tx('▎ 可提供素材', '▎ 可提供素材', '▎ Available source materials'));
      materials.forEach(m => lines.push('  • ' + labelFor.material(m)));
      lines.push('');
    }

    lines.push(tx('▎ 專案規模', '▎ 项目规模', '▎ Project scope'));
    lines.push((tx('  總時長：', '  总时长：', '  Total duration: ')) + durationMinutes.trim() + (isZh ? ' 分鐘' : ' min'));
    if (episodes.trim())  lines.push((tx('  集數 / 段數：', '  集数 / 段数：', '  Episodes / segments: ')) + episodes.trim());
    if (characters.trim()) lines.push((tx('  角色 / 聲音數：', '  角色 / 声音数：', '  Characters / voices: ')) + characters.trim());
    lines.push((tx('  用途：', '  用途：', '  Use case: ')) + labelFor.useCase(useCase as UseCase));
    lines.push('');

    lines.push(tx('▎ 交期', '▎ 交期', '▎ Timeline'));
    lines.push('  ' + labelFor.timeline(timeline as Timeline));
    lines.push('');

    if (references.trim() || notes.trim()) {
      lines.push(tx('▎ 參考 / 補充', '▎ 参考 / 补充', '▎ References / notes'));
      if (references.trim()) {
        lines.push(tx('  參考 / 風格：', '  参考 / 风格：', '  References:'));
        references.trim().split('\n').forEach(l => lines.push('    ' + l));
      }
      if (notes.trim()) {
        lines.push(tx('  其他備註：', '  其他备注：', '  Notes:'));
        notes.trim().split('\n').forEach(l => lines.push('    ' + l));
      }
      lines.push('');
    }

    lines.push(tx('▎ 聯絡', '▎ 联络', '▎ Contact'));
    if (company.trim()) lines.push((tx('  公司：', '  公司：', '  Company: ')) + company.trim());

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
          source: 'dubbing-brief',
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
      console.error('[Dubbing Brief] submit error:', err);
    } finally {
      setSending(false);
    }
  };

  // ---- Success state ---------------------------------------------------
  if (sent) {
    return (
      <main className="min-h-screen bg-black text-white">
        <section className="pt-32 pb-20 px-4">
          <div className="max-w-xl mx-auto text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-400 mb-6" />
            <h1 className="text-3xl md:text-4xl font-bold mb-3">
              {tx('需求已收到', '需求已收到', "Brief received")}
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
                <span className="font-mono text-blue-300">{inquiryNumber}</span>
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <Link
                href="/dubbing"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-sm border border-white/10"
              >
                <ArrowLeft className="w-4 h-4" />
                {tx('回配音工作室', '回配音工作室', 'Back to Dubbing')}
              </Link>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-blue-500 text-black font-semibold text-sm hover:bg-blue-400"
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

  // ---- Brief form ------------------------------------------------------
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="pt-28 pb-8 px-4">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/dubbing"
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition mb-6"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {tx('回配音工作室', '回配音工作室', 'Back to Dubbing')}
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {tx('配音案件需求', '配音项目需求', 'Dubbing Project Brief')}
          </h1>
          <p className="text-gray-400">
            {tx(
              '送出後 1 個工作日內以 email 回覆報價與製作時程。',
              '送出后 1 个工作日内以 email 回复报价与制作时程。',
              'Quote and production timeline emailed within 1 business day.'
            )}
          </p>
        </div>
      </section>

      <section className="px-4 pb-24">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-10">

          {/* SECTION 1: Languages */}
          <Section title={tx('語言', '语言', 'Languages')} required>
            <Field label={tx('原始語言', '原始语言', 'Source language')} required>
              <div className="flex flex-wrap gap-2">
                {LANGS.map(l => {
                  const active = sourceLanguage === l.code;
                  return (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => setSourceLanguage(l.code)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition ${
                        active ? 'bg-blue-500 text-black border-blue-500'
                               : 'bg-white/5 text-gray-300 border-white/10 hover:border-white/30'
                      }`}
                    >
                      {isZhCN ? l.label.cn : isZh ? l.label.tw : l.label.en}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label={tx('目標語種（可多選）', '目标语种（可多选）', 'Target languages (multi-select)')} required>
              <div className="flex flex-wrap gap-2">
                {LANGS.map(l => {
                  const active = targetLanguages.includes(l.code);
                  return (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => toggleLang(l.code)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition ${
                        active ? 'bg-blue-500 text-black border-blue-500'
                               : 'bg-white/5 text-gray-300 border-white/10 hover:border-white/30'
                      }`}
                    >
                      {isZhCN ? l.label.cn : isZh ? l.label.tw : l.label.en}
                    </button>
                  );
                })}
              </div>
            </Field>
          </Section>

          {/* SECTION 2: Video / source */}
          <Section title={tx('影片 / 音源', '视频 / 音源', 'Video / source')} required>
            <Field label={tx('影片連結（可選 — 沒有也可以先送出，稍後再補）', '视频链接（可选 — 没有也可以先送出，稍后再补）', 'Video URL (optional — can be added later)')}>
              <input
                type="url"
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                placeholder={tx('https://youtube.com / vimeo.com / 雲端硬碟連結',
                                'https://youtube.com / vimeo.com / 云盘链接',
                                'https://youtube.com / vimeo.com / cloud drive link')}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500/60"
              />
            </Field>
            <Field label={tx('對嘴需求', '对嘴需求', 'Lip-sync requirement')} required>
              <Choices
                value={lipsync}
                onSelect={(v) => setLipsync(v as LipsyncMode)}
                options={(['full', 'voiceover', 'loose'] as LipsyncMode[])
                  .map(k => [k, labelFor.lipsync(k)] as [string, string])}
              />
            </Field>
          </Section>

          {/* SECTION 3: Voice approach — drives the production pipeline + legal exposure */}
          <Section
            title={tx('聲音方式', '声音方式', 'Voice approach')}
            required
            hint={tx(
              '保留原聲 = AI 克隆原配音員的聲線到新語言（RVC）。新聲音 = AI 生成。真人 = Onyx 配音員陣容。',
              '保留原声 = AI 克隆原配音员的声线到新语言（RVC）。新声音 = AI 生成。真人 = Onyx 配音员阵容。',
              "Preserve = RVC clone of original talent. New AI = fresh AI voices. Human = Onyx talent roster."
            )}
          >
            <Choices
              value={voiceApproach}
              onSelect={(v) => setVoiceApproach(v as VoiceApproach)}
              options={(['preserve', 'newAI', 'human'] as VoiceApproach[])
                .map(k => [k, labelFor.voiceApproach(k)] as [string, string])}
            />
          </Section>

          {/* SECTION 3.5: RVC consent — only renders when "preserve" picked */}
          {needsConsent && (
            <Section
              title={tx('RVC 授權確認', 'RVC 授权确认', 'RVC authorization')}
              required
              hint={tx(
                '克隆原配音員的聲線必須先取得授權。請選擇其中一項：',
                '克隆原配音员的声线必须先取得授权。请选择其中一项：',
                "Cloning the original talent's voice requires authorization. Pick one:"
              )}
            >
              <Choices
                value={consentMode}
                onSelect={(v) => setConsentMode(v as ConsentMode)}
                options={(['have', 'needTemplate', 'attest'] as ConsentMode[])
                  .map(k => [k, labelFor.consent(k)] as [string, string])}
              />
            </Section>
          )}

          {/* SECTION 4: Script status — replaces the old AI-draft binary */}
          <Section
            title={tx('翻譯稿狀態', '翻译稿状态', 'Script status')}
            required
            hint={tx(
              '已有完整翻譯稿最便宜；AI 草稿需校對；從原文翻譯最完整。',
              '已有完整翻译稿最便宜；AI 草稿需校对；从原文翻译最完整。',
              'Pro script ready = cheapest. AI draft = needs proofread. From-scratch = full package.'
            )}
          >
            <Choices
              value={scriptStatus}
              onSelect={(v) => setScriptStatus(v as ScriptStatus)}
              options={(['fullScript', 'aiDraft', 'fromScratch'] as ScriptStatus[])
                .map(k => [k, labelFor.scriptStatus(k)] as [string, string])}
            />
          </Section>

          {/* SECTION 5: Available source materials — pricing driver */}
          <Section
            title={tx('可提供素材（可多選）', '可提供素材（可多选）', 'Available source materials (multi-select)')}
            hint={tx(
              '勾越多越好估算 — 有分軌的案件處理快、報價低；只有完成片要做分離 + 重新合成，較複雜。',
              '勾越多越好估算 — 有分轨的项目处理快、报价低；只有完成片要做分离 + 重新合成，较复杂。',
              'The more you can provide, the cleaner the quote. Stems = faster + cheaper. Finished-only = needs separation + re-mix.'
            )}
          >
            <div className="flex flex-wrap gap-2">
              {(['sourceVideo', 'vocalStem', 'musicStem', 'sfxStem', 'osVersion', 'finishedOnly'] as Material[]).map(m => {
                const active = materials.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleMaterial(m)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition ${
                      active ? 'bg-blue-500 text-black border-blue-500'
                             : 'bg-white/5 text-gray-300 border-white/10 hover:border-white/30'
                    }`}
                  >
                    {labelFor.material(m)}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* SECTION 4: Project scope */}
          <Section title={tx('專案規模', '项目规模', 'Project scope')} required>
            <Field label={tx('總時長（分鐘）', '总时长（分钟）', 'Total duration (minutes)')} required>
              <input
                type="number"
                value={durationMinutes}
                onChange={e => setDurationMinutes(e.target.value)}
                placeholder={tx('例：120', '例：120', 'e.g. 120')}
                className="w-full max-w-xs px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500/60"
              />
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label={tx('集數 / 段數', '集数 / 段数', 'Episodes / segments')}>
                <input
                  type="text"
                  value={episodes}
                  onChange={e => setEpisodes(e.target.value)}
                  placeholder={tx('可選', '可选', 'Optional')}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500/60"
                />
              </Field>
              <Field label={tx('角色 / 聲音數', '角色 / 声音数', 'Characters / voices')}>
                <input
                  type="text"
                  value={characters}
                  onChange={e => setCharacters(e.target.value)}
                  placeholder={tx('可選', '可选', 'Optional')}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500/60"
                />
              </Field>
            </div>
            <Field label={tx('用途', '用途', 'Use case')} required>
              <Choices
                value={useCase}
                onSelect={(v) => setUseCase(v as UseCase)}
                options={(['film', 'tvSeries', 'shortDrama', 'documentary', 'animation', 'game', 'brand', 'elearning', 'podcast', 'other'] as UseCase[])
                  .map(k => [k, labelFor.useCase(k)] as [string, string])}
              />
            </Field>
          </Section>

          {/* SECTION 5: Timeline */}
          <Section title={tx('交期', '交期', 'Timeline')} required>
            <Choices
              value={timeline}
              onSelect={(v) => setTimeline(v as Timeline)}
              options={(['rush', 'standard', 'flexible'] as Timeline[])
                .map(k => [k, labelFor.timeline(k)] as [string, string])}
            />
          </Section>

          {/* SECTION 6: References / Notes */}
          <Section title={tx('參考 / 補充', '参考 / 补充', 'References / notes')}>
            <Field label={tx('參考樣本 / 風格描述（可選）', '参考样本 / 风格描述（可选）', 'Reference samples / style notes (optional)')}>
              <textarea
                value={references}
                onChange={e => setReferences(e.target.value)}
                rows={3}
                placeholder={tx(
                  '例：類似 Netflix 影集配音風格、希望溫暖大叔感、避免太年輕的聲線',
                  '例：类似 Netflix 影集配音风格、希望温暖大叔感、避免太年轻的声线',
                  'e.g. Netflix-style dubbing tone, warm older male feel, no overly young voices'
                )}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500/60 resize-y"
              />
            </Field>
            <Field label={tx('其他備註（可選）', '其他备注（可选）', 'Other notes (optional)')}>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder={tx('特殊技術需求、預算範圍、授權使用範圍…',
                                '特殊技术需求、预算范围、授权使用范围…',
                                'Technical specs, budget range, usage scope...')}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500/60 resize-y"
              />
            </Field>
          </Section>

          {/* SECTION 7: Contact */}
          <Section title={tx('聯絡方式', '联络方式', 'Contact')}>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={tx('姓名', '姓名', 'Name')} required>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={tx('你的姓名', '你的姓名', 'Your name')}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500/60"
                />
              </Field>
              <Field label="Email" required>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500/60"
                />
              </Field>
              <Field label={tx('公司 / 品牌', '公司 / 品牌', 'Company / brand')}>
                <input
                  type="text"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  placeholder={tx('可選', '可选', 'Optional')}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-blue-500/60"
                />
              </Field>
            </div>
          </Section>

          <button
            type="submit"
            disabled={sending}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-full bg-blue-500 text-black font-semibold hover:bg-blue-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {tx('送出中…', '送出中…', 'Sending…')}</>
              : tx('送出需求 — 24 小時內回覆報價', '送出需求 — 24 小时内回复报价', 'Send brief — quote within 24 hours')
            }
          </button>
          <p className="text-center text-xs text-gray-500">
            {tx(
              '送出後 24 小時內回覆報價，接受報價才付款。',
              '送出后 24 小时内回复报价，接受报价才付款。',
              "We email a quote within 24 hours. You only pay after accepting."
            )}
          </p>
        </form>
      </section>

      <Footer />
    </main>
  );
}

function Section({
  title,
  hint,
  required,
  children,
}: {
  title: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">
          {title}
          {required && <span className="text-blue-400 ml-1">*</span>}
        </h2>
        {hint && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{hint}</p>}
      </div>
      <div className="space-y-4">{children}</div>
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
        {required && <span className="text-blue-400 ml-1">*</span>}
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
              active ? 'bg-blue-500 text-black border-blue-500'
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
