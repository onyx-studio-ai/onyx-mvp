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
type AiDraft = 'has' | 'none';
type UseCase = 'film' | 'game' | 'brand' | 'elearning' | 'podcast' | 'other';
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
  const [aiDraft, setAiDraft] = useState<AiDraft | ''>('');
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
    aiDraft: (a: AiDraft): string => ({
      has:  tx('是 — 已有 AI 翻譯版，需校對 + 真人錄製', '是 — 已有 AI 翻译版，需校对 + 真人录制', "Yes — has AI draft, needs proofread + human recording"),
      none: tx('否 — 從原文開始翻譯 + 錄製', '否 — 从原文开始翻译 + 录制', 'No — translate + record from scratch'),
    }[a]),
    useCase: (u: UseCase): string => ({
      film:       tx('電影 / 戲劇',    '电影 / 戏剧',    'Film / drama'),
      game:       tx('遊戲',           '游戏',           'Game'),
      brand:      tx('品牌廣告',       '品牌广告',       'Brand commercial'),
      elearning:  tx('e-learning / 線上課', 'e-learning / 在线课', 'e-learning / online course'),
      podcast:    tx('Podcast / 有聲書', 'Podcast / 有声书', 'Podcast / audiobook'),
      other:      tx('其他',           '其他',           'Other'),
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
    if (!sourceLanguage || targetLanguages.length === 0 || !lipsync || !aiDraft || !durationMinutes.trim() || !useCase || !timeline) {
      toast.error(tx(
        '請填原語、目標語種、對嘴需求、AI 翻譯草稿、時長、用途、交期',
        '请填原语、目标语种、对嘴需求、AI 翻译草稿、时长、用途、交期',
        'Please fill source lang, target langs, lip-sync, AI draft, duration, use case, timeline'
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

    lines.push(tx('▎ AI 翻譯草稿', '▎ AI 翻译草稿', '▎ AI translation draft'));
    lines.push('  ' + labelFor.aiDraft(aiDraft as AiDraft));
    lines.push('');

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

          {/* SECTION 3: AI draft */}
          <Section title={tx('已有 AI 翻譯草稿?', '已有 AI 翻译草稿?', 'Existing AI translation draft?')} required hint={tx(
            '若你已用 ChatGPT / DeepL 等工具翻過，我們會直接走「校對 + 真人錄製」流程，比從零開始便宜。',
            '若你已用 ChatGPT / DeepL 等工具翻过，我们会直接走「校对 + 真人录制」流程，比从零开始便宜。',
            'If you already translated with ChatGPT / DeepL, we go straight to proofread + recording — cheaper than from-scratch translation.'
          )}>
            <Choices
              value={aiDraft}
              onSelect={(v) => setAiDraft(v as AiDraft)}
              options={(['has', 'none'] as AiDraft[])
                .map(k => [k, labelFor.aiDraft(k)] as [string, string])}
            />
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
                options={(['film', 'game', 'brand', 'elearning', 'podcast', 'other'] as UseCase[])
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
