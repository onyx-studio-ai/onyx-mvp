'use client';

/**
 * /apply/director — session director / language specialist application.
 *
 * Mirrors the role Voices.com is recruiting for in the Asana form Wing
 * filled out: native-speaker directors who can lead directed sessions
 * for AI voice-data clients (Sierra, etc.). Different from voice
 * talent — these people guide performance + assess authenticity, not
 * perform themselves.
 *
 * Submission: POST /api/contact/send (department=PRODUCTION,
 * source=apply-director). Producer reviews within 3-5 days.
 */

import { useState, FormEvent } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import Footer from '@/components/landing/Footer';
import { Section, Field, Choices, Pill, Input, Textarea } from '@/components/forms/PartnerFormHelpers';
import { PARTNER_LANGS, langLabel } from '@/components/forms/PartnerFormLangs';

type Experience = 'less1' | '1to3' | '3to7' | '7to15' | 'over15';
type TTSExperience = 'extensive' | 'some' | 'none';
type AIClientExperience = 'yes' | 'no';

// Director-relevant language subset — drops Punjabi / Polish / Dutch /
// Swedish / Turkish / Arabic variants that the master list has, since
// directors for those are rare in Onyx's current pipeline. Add ids back
// here when demand justifies.
const LANG_IDS = [
  'mandarin-tw', 'mandarin-cn', 'cantonese', 'hokkien',
  'en-us', 'en-uk', 'ja', 'ko',
  'th', 'vi', 'id', 'ms', 'tl',
  'hi', 'bn', 'ta', 'ur',
  'es', 'fr', 'de', 'pt', 'it',
  'ar-msa', 'ru',
];
const LANGS = PARTNER_LANGS.filter(l => LANG_IDS.includes(l.id));

// Remote-session tools — ipDTL is the broadcast/dubbing industry standard
// (added per Wing's audit). Audiomovers is gaining traction with hybrid
// remote-monitoring setups.
const REMOTE_TOOLS = ['Zoom', 'SourceConnect', 'ipDTL', 'Audiomovers', 'Riverside', 'Cleanfeed', 'Google Meet', 'Microsoft Teams', 'Other'];
const AUDIO_TERMS = ['Noise Floor', 'LUFS', 'RMS', 'Peak Levels', 'Signal-to-Noise', 'Spectrogram', 'Sample Rate / Bit Depth'];

export default function ApplyDirectorPage() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  // ---- state -----------------------------------------------------------
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('');
  const [timezone, setTimezone] = useState('');
  const [nativeLanguages, setNativeLanguages] = useState<string[]>([]);
  const [directorLanguages, setDirectorLanguages] = useState<string[]>([]);

  const [experience, setExperience] = useState<Experience | ''>('');
  const [ttsExperience, setTtsExperience] = useState<TTSExperience | ''>('');
  const [aiClientExperience, setAiClientExperience] = useState<AIClientExperience | ''>('');
  const [background, setBackground] = useState(''); // voice acting / coaching / etc.

  const [homeMic, setHomeMic] = useState('');
  const [homeDaw, setHomeDaw] = useState('');
  const [remoteTools, setRemoteTools] = useState<string[]>([]);
  const [audioTerms, setAudioTerms] = useState<string[]>([]);

  const [hoursPerWeek, setHoursPerWeek] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');

  const [sampleWorkUrl, setSampleWorkUrl] = useState('');
  const [pastCredits, setPastCredits] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [referencesText, setReferencesText] = useState('');

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [inquiryNumber, setInquiryNumber] = useState('');

  const toggleNative = (l: string) => setNativeLanguages(p => p.includes(l) ? p.filter(x => x !== l) : [...p, l]);
  const toggleDirectorLang = (l: string) => setDirectorLanguages(p => p.includes(l) ? p.filter(x => x !== l) : [...p, l]);
  const toggleRemoteTool = (t: string) => setRemoteTools(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);
  const toggleAudioTerm = (t: string) => setAudioTerms(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  // ---- labels ----------------------------------------------------------
  const labelFor = {
    experience: (e: Experience): string => ({
      less1:   tx('未滿 1 年',  '未满 1 年',  'Less than 1 year'),
      '1to3':  tx('1-3 年',     '1-3 年',     '1-3 years'),
      '3to7':  tx('3-7 年',     '3-7 年',     '3-7 years'),
      '7to15': tx('7-15 年',    '7-15 年',    '7-15 years'),
      over15:  tx('15+ 年',     '15+ 年',     '15+ years'),
    }[e]),
    tts: (t: TTSExperience): string => ({
      extensive: tx('豐富(導過多個 TTS / AI 語音資料案件)',
                    '丰富(导过多个 TTS / AI 语音资料项目)',
                    'Extensive (directed multiple TTS / AI voice-data projects)'),
      some:      tx('有一些(導過 1-2 個 TTS 相關案件)',
                    '有一些(导过 1-2 个 TTS 相关项目)',
                    'Some (directed 1-2 TTS-related projects)'),
      none:      tx('沒有(但有其他相關導演經驗)',
                    '没有(但有其他相关导演经验)',
                    'None (but have other related direction experience)'),
    }[t]),
    aiClient: (a: AIClientExperience): string => ({
      yes: tx('有 — 帶過 AI 語音資料 / TTS 平台類型案件(Voices / Appen / 大型 AI 公司等)',
              '有 — 带过 AI 语音资料 / TTS 平台类型项目(Voices / Appen / 大型 AI 公司等)',
              'Yes — directed AI voice-data / TTS platform projects (Voices / Appen / major AI clients)'),
      no:  tx('沒有(但有其他相關背景)', '没有(但有其他相关背景)', 'No (but have other relevant background)'),
    }[a]),
  };

  // ---- submit ----------------------------------------------------------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !email.trim()) {
      toast.error(tx('請填姓名 + Email', '请填姓名 + Email', 'Please fill name + email'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error(tx('Email 格式不對', 'Email 格式不对', 'Please enter a valid email'));
      return;
    }
    if (nativeLanguages.length === 0 || directorLanguages.length === 0 || !experience || !ttsExperience || !linkedinUrl.trim()) {
      toast.error(tx(
        '請填母語、可帶 session 的語種、年資、TTS 經驗、LinkedIn URL',
        '请填母语、可带 session 的语种、年资、TTS 经验、LinkedIn URL',
        'Please fill native languages, director languages, experience, TTS experience, LinkedIn URL'
      ));
      return;
    }

    const lines: string[] = [];
    lines.push(tx('=== 聲音導演申請 ===', '=== 声音导演申请 ===', '=== Session Director Application ==='));
    lines.push('');

    lines.push(tx('▎ 基本資訊', '▎ 基本资讯', '▎ Basic info'));
    lines.push((tx('  姓名:', '  姓名:', '  Name: ')) + fullName.trim());
    if (country.trim())  lines.push((tx('  國家 / 城市:', '  国家 / 城市:', '  Country / city: ')) + country.trim());
    if (timezone.trim()) lines.push((tx('  時區:', '  时区:', '  Time zone: ')) + timezone.trim());
    lines.push((tx('  母語:', '  母语:', '  Native languages: ')) + nativeLanguages.map(id => langLabel(id, locale)).join('、'));
    lines.push('');

    lines.push(tx('▎ 可帶 session 的語種', '▎ 可带 session 的语种', '▎ Languages you can direct'));
    directorLanguages.forEach(id => lines.push('  • ' + langLabel(id, locale)));
    lines.push('');

    lines.push(tx('▎ 經驗', '▎ 经验', '▎ Experience'));
    lines.push((tx('  年資:', '  年资:', '  Years: ')) + labelFor.experience(experience as Experience));
    lines.push((tx('  TTS / AI 語音資料經驗:', '  TTS / AI 语音资料经验:', '  TTS / AI voice-data experience: ')) + labelFor.tts(ttsExperience as TTSExperience));
    if (aiClientExperience) {
      lines.push((tx('  AI 平台客戶經驗:', '  AI 平台客户经验:', '  AI platform client experience: ')) + labelFor.aiClient(aiClientExperience as AIClientExperience));
    }
    if (background.trim()) {
      lines.push((tx('  其他背景:', '  其他背景:', '  Other background: ')));
      background.trim().split('\n').forEach(l => lines.push('    ' + l));
    }
    lines.push('');

    if (homeMic.trim() || homeDaw.trim() || remoteTools.length > 0 || audioTerms.length > 0) {
      lines.push(tx('▎ 技術 / 設備', '▎ 技术 / 设备', '▎ Technical / equipment'));
      if (homeMic.trim()) lines.push((tx('  Home mic:', '  Home mic:', '  Home mic: ')) + homeMic.trim());
      if (homeDaw.trim()) lines.push((tx('  Home DAW:', '  Home DAW:', '  Home DAW: ')) + homeDaw.trim());
      if (remoteTools.length > 0) lines.push((tx('  遠端 session 工具:', '  远端 session 工具:', '  Remote session tools: ')) + remoteTools.join('、'));
      if (audioTerms.length > 0)  lines.push((tx('  音訊術語熟悉:', '  音讯术语熟悉:', '  Audio terminology familiar: ')) + audioTerms.join('、'));
      lines.push('');
    }

    if (hoursPerWeek.trim() || hourlyRate.trim()) {
      lines.push(tx('▎ 可配合度', '▎ 可配合度', '▎ Availability'));
      if (hoursPerWeek.trim()) lines.push((tx('  每週小時數:', '  每周小时数:', '  Hours / week: ')) + hoursPerWeek.trim());
      if (hourlyRate.trim())   lines.push((tx('  時薪(USD):', '  时薪(USD):', '  Hourly rate (USD): ')) + hourlyRate.trim());
      lines.push('');
    }

    lines.push(tx('▎ 作品與資歷', '▎ 作品与资历', '▎ Portfolio'));
    lines.push((tx('  LinkedIn:', '  LinkedIn:', '  LinkedIn: ')) + linkedinUrl.trim());
    if (sampleWorkUrl.trim()) lines.push((tx('  作品樣本 URL:', '  作品样本 URL:', '  Sample / showreel URL: ')) + sampleWorkUrl.trim());
    if (pastCredits.trim()) {
      lines.push((tx('  過往代表案件:', '  过往代表项目:', '  Past credits:')));
      pastCredits.trim().split('\n').forEach(l => lines.push('    ' + l));
    }
    if (referencesText.trim()) {
      lines.push((tx('  推薦人(可聯繫的過往合作對象):', '  推荐人(可联系的过往合作对象):', '  References (past collaborators willing to vouch):')));
      referencesText.trim().split('\n').forEach(l => lines.push('    ' + l));
    }
    lines.push('');

    if (notes.trim()) {
      lines.push(tx('▎ 備註', '▎ 备注', '▎ Notes'));
      notes.trim().split('\n').forEach(l => lines.push('  ' + l));
      lines.push('');
    }

    lines.push(tx('▎ 聯絡', '▎ 联络', '▎ Contact'));
    if (phone.trim()) lines.push((tx('  電話 / WhatsApp / LINE:', '  电话 / WhatsApp / LINE:', '  Phone / WA / LINE: ')) + phone.trim());

    const messageBody = lines.join('\n');

    setSending(true);
    try {
      const res = await fetch('/api/contact/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fullName.trim(),
          email: email.trim(),
          message: messageBody,
          department: 'PRODUCTION',
          source: 'apply-director',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'send failed');
      setInquiryNumber(data.inquiryNumber || '');
      setSent(true);
    } catch (err) {
      toast.error(tx('送出失敗,請稍後再試', '送出失败,请稍后再试', 'Send failed, please retry'));
      console.error('[Apply Director] submit error:', err);
    } finally {
      setSending(false);
    }
  };

  // ---- success ---------------------------------------------------------
  if (sent) {
    return (
      <main className="min-h-screen bg-black text-white">
        <section className="pt-32 pb-20 px-4">
          <div className="max-w-xl mx-auto text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-400 mb-6" />
            <h1 className="text-3xl md:text-4xl font-bold mb-3">
              {tx('申請已收到', '申请已收到', 'Application received')}
            </h1>
            <p className="text-gray-400 mb-6">
              {tx(
                '製作團隊會在 3-5 個工作日內審核並以 email 回覆。',
                '制作团队会在 3-5 个工作日内审核并以 email 回复。',
                "Our production team will review and reply by email within 3-5 business days."
              )}
            </p>
            {inquiryNumber && (
              <div className="inline-block px-4 py-2 rounded-lg bg-white/5 border border-white/10 mb-8">
                <span className="text-gray-400 text-sm mr-2">{tx('參考編號', '参考编号', 'Reference')}:</span>
                <span className="font-mono text-amber-300">{inquiryNumber}</span>
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <Link href="/apply" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-sm border border-white/10">
                <ArrowLeft className="w-4 h-4" />
                {tx('回 Partner Network', '回 Partner Network', 'Back to Partner Network')}
              </Link>
              <Link href="/" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400">
                {tx('首頁', '首页', 'Home')}
              </Link>
            </div>
          </div>
        </section>
        <Footer />
      </main>
    );
  }

  // ---- form ------------------------------------------------------------
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="pt-28 pb-8 px-4">
        <div className="max-w-3xl mx-auto">
          <Link href="/apply" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition mb-6">
            <ArrowLeft className="w-3.5 h-3.5" />
            {tx('回 Partner Network', '回 Partner Network', 'Back to Partner Network')}
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {tx('聲音導演申請', '声音导演申请', 'Session Director Application')}
          </h1>
          <p className="text-gray-400">
            {tx(
              '審核時間 3-5 個工作日。聲音導演需具備母語直接帶 directed session 的能力與經驗。',
              '审核时间 3-5 个工作日。声音导演需具备母语直接带 directed session 的能力与经验。',
              'Review takes 3-5 business days. Session directors must be able to lead directed sessions in their native language with proven experience.'
            )}
          </p>
        </div>
      </section>

      <section className="px-4 pb-24">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-10">

          <Section title={tx('基本資訊', '基本资讯', 'Basic info')} required>
            <Field label={tx('姓名', '姓名', 'Full name')} required>
              <Input value={fullName} onChange={setFullName} />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={tx('國家 / 城市', '国家 / 城市', 'Country / city')}>
                <Input value={country} onChange={setCountry} placeholder={tx('例:台灣 台北', '例:台湾 台北', 'e.g. Taiwan, Taipei')} />
              </Field>
              <Field label={tx('時區', '时区', 'Time zone')}>
                <Input value={timezone} onChange={setTimezone} placeholder={tx('例:GMT+8 / UTC-5', '例:GMT+8 / UTC-5', 'e.g. GMT+8 / UTC-5')} />
              </Field>
            </div>
            <Field label={tx('母語(可複選)', '母语(可复选)', 'Native languages (multi-select)')} required>
              <div className="flex flex-wrap gap-2">
                {LANGS.map(l => (
                  <Pill key={l.id} active={nativeLanguages.includes(l.id)} onClick={() => toggleNative(l.id)} label={langLabel(l.id, locale)} />
                ))}
              </div>
            </Field>
          </Section>

          <Section title={tx('可帶 session 的語種', '可带 session 的语种', 'Languages you can direct')} required hint={tx(
            '不一定是母語 — 只要你能用該語種直接引導表演,不需要翻譯員協助。',
            '不一定是母语 — 只要你能用该语种直接引导表演,不需要翻译员协助。',
            'Not necessarily native — any language where you can direct performance without a translator.'
          )}>
            <div className="flex flex-wrap gap-2">
              {LANGS.map(l => (
                <Pill key={l.id} active={directorLanguages.includes(l.id)} onClick={() => toggleDirectorLang(l.id)} label={langLabel(l.id, locale)} />
              ))}
            </div>
          </Section>

          <Section title={tx('經驗', '经验', 'Experience')} required>
            <Field label={tx('聲音導演年資', '声音导演年资', 'Years of session direction experience')} required>
              <Choices value={experience} onSelect={v => setExperience(v as Experience)}
                options={(['less1','1to3','3to7','7to15','over15'] as Experience[]).map(k => [k, labelFor.experience(k)] as [string, string])} />
            </Field>
            <Field label={tx('TTS / AI 語音資料案件經驗', 'TTS / AI 语音资料项目经验', 'TTS / AI voice-data experience')} required>
              <Choices value={ttsExperience} onSelect={v => setTtsExperience(v as TTSExperience)}
                options={(['extensive','some','none'] as TTSExperience[]).map(k => [k, labelFor.tts(k)] as [string, string])} />
            </Field>
            <Field
              label={tx('AI 平台客戶經驗', 'AI 平台客户经验', 'AI platform client experience')}
              hint={tx(
                '是否帶過 Voices.com / Appen / 大型 AI 公司類型案件? Sierra-tier 客戶 demand 越來越多有此經驗的聲導。',
                '是否带过 Voices.com / Appen / 大型 AI 公司类型项目? Sierra-tier 客户 demand 越来越多有此经验的声导。',
                'Have you directed AI platform projects (Voices.com / Appen / major AI clients)? Sierra-tier clients increasingly require this background.'
              )}
            >
              <Choices value={aiClientExperience} onSelect={v => setAiClientExperience(v as AIClientExperience)}
                options={(['yes','no'] as AIClientExperience[]).map(k => [k, labelFor.aiClient(k)] as [string, string])} />
            </Field>
            <Field label={tx('其他相關背景', '其他相关背景', 'Other relevant background')} hint={tx(
              '例:配音、表演、音樂製作、廣告創意、教學等。',
              '例:配音、表演、音乐制作、广告创意、教学等。',
              'e.g. voice acting, performance, music production, ad creative, coaching, etc.'
            )}>
              <Textarea value={background} onChange={setBackground} placeholder={tx(
                '簡述你的背景與相關經歷...',
                '简述你的背景与相关经历...',
                'Briefly describe your background and relevant experience...'
              )} />
            </Field>
          </Section>

          <Section title={tx('技術 / 設備', '技术 / 设备', 'Technical / equipment')}>
            <Field label={tx('Home recording 麥克風', 'Home recording 麦克风', 'Home recording microphone')}>
              <Input value={homeMic} onChange={setHomeMic} placeholder={tx('例:Blue Yeti / Shure SM7B / 沒有 / ...', '例:Blue Yeti / Shure SM7B / 没有 / ...', 'e.g. Blue Yeti / Shure SM7B / none / ...')} />
            </Field>
            <Field label={tx('Home DAW', 'Home DAW', 'Home DAW')}>
              <Input value={homeDaw} onChange={setHomeDaw} placeholder="GarageBand / Logic Pro / Audacity / ..." />
            </Field>
            <Field label={tx('遠端 session 工具熟悉(可複選)', '远端 session 工具熟悉(可复选)', 'Remote session tools (multi-select)')}>
              <div className="flex flex-wrap gap-2">
                {REMOTE_TOOLS.map(t => (
                  <Pill
                    key={t}
                    active={remoteTools.includes(t)}
                    onClick={() => toggleRemoteTool(t)}
                    label={t === 'Other' ? tx('其他', '其他', 'Other') : t}
                  />
                ))}
              </div>
            </Field>
            <Field label={tx('音訊術語熟悉(可複選)', '音讯术语熟悉(可复选)', 'Audio terminology familiar (multi-select)')}>
              <div className="flex flex-wrap gap-2">
                {AUDIO_TERMS.map(t => (
                  <Pill key={t} active={audioTerms.includes(t)} onClick={() => toggleAudioTerm(t)} label={t} />
                ))}
              </div>
            </Field>
          </Section>

          <Section title={tx('可配合度', '可配合度', 'Availability')}>
            <Field label={tx('每週可接小時數', '每周可接小时数', 'Hours per week available')}>
              <Input value={hoursPerWeek} onChange={setHoursPerWeek} placeholder={tx('例:10-20 小時', '例:10-20 小时', 'e.g. 10-20 hours')} />
            </Field>
            <Field
              label={tx('費用期望(USD)', '费用期望(USD)', 'Rate expectation (USD)')}
              hint={tx(
                '聲導工作常見 3 種計價:時薪 / 每場 session(3-4 hr block)/ 日薪。請填你最常用的格式 + 數字。',
                '声导工作常见 3 种计价:时薪 / 每场 session(3-4 hr block)/ 日薪。请填你最常用的格式 + 数字。',
                'Director rates are commonly quoted 3 ways: hourly / per session (3-4 hr block) / day rate. State your preferred format and amount.'
              )}
            >
              <Input value={hourlyRate} onChange={setHourlyRate} placeholder={tx(
                '例:$120 / hr  或  $400 / session  或  $1,000 / day',
                '例:$120 / hr  或  $400 / session  或  $1,000 / day',
                'e.g. $120 / hr  or  $400 / session  or  $1,000 / day'
              )} />
            </Field>
          </Section>

          <Section
            title={tx('作品 / 資歷', '作品 / 资历', 'Portfolio')}
            required
            hint={tx(
              'Onyx 對外承接案件的品質責任要求每位聲導提供可驗證的學經歷:LinkedIn 必填、過往案件具體描述。我們會以這些公開資料交叉比對你的陳述。',
              'Onyx 对外承接项目的质量责任要求每位声导提供可验证的学经历:LinkedIn 必填、过往项目具体描述。我们会以这些公开资料交叉比对你的陈述。',
              "Onyx's quality commitment requires verifiable credentials: LinkedIn is required, past credits must be specific. We cross-check stated experience against public records."
            )}
          >
            <Field label="LinkedIn URL" required>
              <Input value={linkedinUrl} onChange={setLinkedinUrl} placeholder="https://linkedin.com/in/..." />
            </Field>
            <Field
              label={tx('作品樣本 URL(選填)', '作品样本 URL(选填)', 'Sample / showreel URL (optional)')}
              hint={tx(
                'Session 引導 demo / 過往作品 / showreel / Vimeo / YouTube 皆可 — 聲導不一定有自己的錄音,但有作品反映導演風格更有幫助。',
                'Session 引导 demo / 过往作品 / showreel / Vimeo / YouTube 皆可 — 声导不一定有自己的录音,但有作品反映导演风格更有帮助。',
                'Session-direction demo / past work / showreel / Vimeo / YouTube — directors don\'t always record themselves, but anything reflecting your direction style helps.'
              )}
            >
              <Input value={sampleWorkUrl} onChange={setSampleWorkUrl} placeholder="https://..." />
            </Field>
            <Field
              label={tx('過往代表案件 / 客戶', '过往代表项目 / 客户', 'Past credits / clients')}
              hint={tx(
                '請列舉 3-5 個代表案件,每個包含:年份、案件類型、語種、規模、客戶名稱。具體越多越有說服力 — 模糊陳述(只說「導過 Disney」沒寫年份 / 案件)會被降低權重。',
                '请列举 3-5 个代表项目,每个包含:年份、项目类型、语种、规模、客户名称。具体越多越有说服力 — 模糊陈述(只说「导过 Disney」没写年份 / 项目)会被降低权重。',
                'List 3-5 notable credits. For each: year, project type, language, scale, client. Specificity wins — vague claims ("directed for Disney" with no year / title) get weighted down.'
              )}
            >
              <Textarea
                value={pastCredits}
                onChange={setPastCredits}
                rows={5}
                placeholder={tx(
                  '2023 / Disney 動畫 / 國語配音導演 / 80 集 / 客戶:迪士尼台灣\n2022 / 大型 TTS 採集 directed session / 普通話 / 6 位配音員 × 3hr / 客戶:Foo AI\n...',
                  '2023 / Disney 动画 / 国语配音导演 / 80 集 / 客户:迪士尼台湾\n2022 / 大型 TTS 采集 directed session / 普通话 / 6 位配音员 × 3hr / 客户:Foo AI\n...',
                  '2023 / Disney animation / Mandarin VO direction / 80 eps / Client: Disney Taiwan\n2022 / Large-scale TTS directed session / Mandarin / 6 talents × 3hr / Client: Foo AI\n...'
                )}
              />
            </Field>
            <Field
              label={tx('推薦人(選填,加快審核)', '推荐人(选填,加快审核)', 'References (optional, speeds review)')}
              hint={tx(
                '過往合作的製作人 / 客戶 / 配音員願意為你背書 — 提供姓名 + 公司 + Email + 合作關係。Onyx 可能會直接聯繫驗證。',
                '过往合作的制作人 / 客户 / 配音员愿意为你背书 — 提供姓名 + 公司 + Email + 合作关系。Onyx 可能会直接联系验证。',
                'Past producer / client / talent willing to vouch for you — name + company + email + relationship. Onyx may contact them.'
              )}
            >
              <Textarea
                value={referencesText}
                onChange={setReferencesText}
                rows={3}
                placeholder={tx(
                  '姓名 / 公司 / Email / 合作關係',
                  '姓名 / 公司 / Email / 合作关系',
                  'Name / Company / Email / Relationship'
                )}
              />
            </Field>
          </Section>

          <Section title={tx('聯絡', '联络', 'Contact')} required>
            <Field label="Email" required>
              <Input value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
            </Field>
            <Field
              label={tx('電話(選填)', '电话(选填)', 'Phone (optional)')}
              hint={tx(
                '想要直接 / 加快聯絡的填,否則我們以 email 回覆。',
                '想要直接 / 加快联系的填,否则我们以 email 回复。',
                'Fill if you want direct / faster contact, otherwise we reply by email.'
              )}
            >
              <Input value={phone} onChange={setPhone} placeholder={tx('包含國碼,例如 +886 ...', '包含国码,例如 +886 ...', 'Include country code, e.g. +1 ...')} />
            </Field>
            <Field label={tx('補充說明', '补充说明', 'Notes')}>
              <Textarea value={notes} onChange={setNotes} />
            </Field>
            <p className="text-xs text-gray-500 leading-relaxed pt-2">
              {tx('其他聯絡方式,請見我們的', '其他联系方式,请见我们的', 'Other contact methods — see our ')}
              <Link href="/contact" className="text-amber-300 hover:text-amber-200 underline">
                {tx('官方聯絡頁', '官方联系页', 'official contact page')}
              </Link>
              {tx('。', '。', '.')}
            </p>
          </Section>

          <div className="pt-2">
            <button type="submit" disabled={sending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 text-black px-8 py-4 font-semibold hover:bg-amber-400 transition disabled:opacity-50">
              {sending ? tx('送出中…', '送出中…', 'Sending…') : tx('送出申請', '送出申请', 'Submit application')}
            </button>
          </div>

        </form>
      </section>

      <Footer />
    </main>
  );
}
