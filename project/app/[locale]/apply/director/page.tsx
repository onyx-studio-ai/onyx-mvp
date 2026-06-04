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

type Experience = 'less1' | '1to3' | '3to7' | '7to15' | 'over15';
type TTSExperience = 'extensive' | 'some' | 'none';

const LANGS = [
  'Mandarin (TW)', 'Mandarin (CN)', 'Cantonese', 'Hokkien',
  'English (US)', 'English (UK)', 'Japanese', 'Korean',
  'Thai', 'Vietnamese', 'Indonesian', 'Malay', 'Tagalog',
  'Hindi', 'Bengali', 'Tamil', 'Urdu',
  'Spanish', 'French', 'German', 'Portuguese', 'Italian',
  'Arabic (MSA)', 'Russian',
];

const REMOTE_TOOLS = ['Zoom', 'SourceConnect', 'Riverside', 'Cleanfeed', 'Google Meet', 'Microsoft Teams', 'Other'];
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
    if (nativeLanguages.length === 0 || directorLanguages.length === 0 || !experience || !ttsExperience) {
      toast.error(tx(
        '請填母語、可帶 session 的語種、年資、TTS 經驗',
        '请填母语、可带 session 的语种、年资、TTS 经验',
        'Please fill native languages, director languages, experience, TTS experience'
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
    lines.push((tx('  母語:', '  母语:', '  Native languages: ')) + nativeLanguages.join('、'));
    lines.push('');

    lines.push(tx('▎ 可帶 session 的語種', '▎ 可带 session 的语种', '▎ Languages you can direct'));
    directorLanguages.forEach(l => lines.push('  • ' + l));
    lines.push('');

    lines.push(tx('▎ 經驗', '▎ 经验', '▎ Experience'));
    lines.push((tx('  年資:', '  年资:', '  Years: ')) + labelFor.experience(experience as Experience));
    lines.push((tx('  TTS / AI 語音資料經驗:', '  TTS / AI 语音资料经验:', '  TTS / AI voice-data experience: ')) + labelFor.tts(ttsExperience as TTSExperience));
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

    if (sampleWorkUrl.trim() || pastCredits.trim() || linkedinUrl.trim()) {
      lines.push(tx('▎ 作品與資歷', '▎ 作品与资历', '▎ Portfolio'));
      if (sampleWorkUrl.trim()) lines.push((tx('  樣本 URL:', '  样本 URL:', '  Sample URL: ')) + sampleWorkUrl.trim());
      if (linkedinUrl.trim())   lines.push((tx('  LinkedIn:', '  LinkedIn:', '  LinkedIn: ')) + linkedinUrl.trim());
      if (pastCredits.trim()) {
        lines.push((tx('  過往代表案件:', '  过往代表项目:', '  Past credits:')));
        pastCredits.trim().split('\n').forEach(l => lines.push('    ' + l));
      }
      lines.push('');
    }

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

          <Section title={tx('01 基本資訊', '01 基本资讯', '01 Basic info')} required>
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
                  <Pill key={l} active={nativeLanguages.includes(l)} onClick={() => toggleNative(l)} label={l} />
                ))}
              </div>
            </Field>
          </Section>

          <Section title={tx('02 可帶 session 的語種', '02 可带 session 的语种', '02 Languages you can direct')} required hint={tx(
            '不一定是母語 — 只要你能用該語種直接引導表演,不需要翻譯員協助。',
            '不一定是母语 — 只要你能用该语种直接引导表演,不需要翻译员协助。',
            'Not necessarily native — any language where you can direct performance without a translator.'
          )}>
            <div className="flex flex-wrap gap-2">
              {LANGS.map(l => (
                <Pill key={l} active={directorLanguages.includes(l)} onClick={() => toggleDirectorLang(l)} label={l} />
              ))}
            </div>
          </Section>

          <Section title={tx('03 經驗', '03 经验', '03 Experience')} required>
            <Field label={tx('聲音導演年資', '声音导演年资', 'Years of session direction experience')} required>
              <Choices value={experience} onSelect={v => setExperience(v as Experience)}
                options={(['less1','1to3','3to7','7to15','over15'] as Experience[]).map(k => [k, labelFor.experience(k)] as [string, string])} />
            </Field>
            <Field label={tx('TTS / AI 語音資料案件經驗', 'TTS / AI 语音资料项目经验', 'TTS / AI voice-data experience')} required>
              <Choices value={ttsExperience} onSelect={v => setTtsExperience(v as TTSExperience)}
                options={(['extensive','some','none'] as TTSExperience[]).map(k => [k, labelFor.tts(k)] as [string, string])} />
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

          <Section title={tx('04 技術 / 設備', '04 技术 / 设备', '04 Technical / equipment')}>
            <Field label={tx('Home recording 麥克風', 'Home recording 麦克风', 'Home recording microphone')}>
              <Input value={homeMic} onChange={setHomeMic} placeholder={tx('例:Blue Yeti / Shure SM7B / 沒有 / ...', '例:Blue Yeti / Shure SM7B / 没有 / ...', 'e.g. Blue Yeti / Shure SM7B / none / ...')} />
            </Field>
            <Field label={tx('Home DAW', 'Home DAW', 'Home DAW')}>
              <Input value={homeDaw} onChange={setHomeDaw} placeholder="GarageBand / Logic Pro / Audacity / ..." />
            </Field>
            <Field label={tx('遠端 session 工具熟悉(可複選)', '远端 session 工具熟悉(可复选)', 'Remote session tools (multi-select)')}>
              <div className="flex flex-wrap gap-2">
                {REMOTE_TOOLS.map(t => (
                  <Pill key={t} active={remoteTools.includes(t)} onClick={() => toggleRemoteTool(t)} label={t} />
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

          <Section title={tx('05 可配合度', '05 可配合度', '05 Availability')}>
            <Field label={tx('每週可接小時數', '每周可接小时数', 'Hours per week available')}>
              <Input value={hoursPerWeek} onChange={setHoursPerWeek} placeholder={tx('例:10-20 小時', '例:10-20 小时', 'e.g. 10-20 hours')} />
            </Field>
            <Field label={tx('時薪期望(USD)', '时薪期望(USD)', 'Hourly rate (USD)')}>
              <Input value={hourlyRate} onChange={setHourlyRate} placeholder={tx('例:$80-150 / 小時', '例:$80-150 / 小时', 'e.g. $80-150 / hour')} />
            </Field>
          </Section>

          <Section title={tx('06 作品 / 資歷', '06 作品 / 资历', '06 Portfolio')} hint={tx(
            'Onyx 會依作品與資歷判斷適配的案件類型。',
            'Onyx 会依作品与资历判断适配的项目类型。',
            "Onyx matches projects to your portfolio and credentials."
          )}>
            <Field label={tx('樣本錄音 URL(Drive / 雲端)', '样本录音 URL(Drive / 云盘)', 'Sample recording URL (Drive)')}>
              <Input value={sampleWorkUrl} onChange={setSampleWorkUrl} placeholder="https://..." />
            </Field>
            <Field label="LinkedIn URL">
              <Input value={linkedinUrl} onChange={setLinkedinUrl} placeholder="https://linkedin.com/in/..." />
            </Field>
            <Field label={tx('過往代表案件 / 客戶', '过往代表项目 / 客户', 'Past credits / clients')}>
              <Textarea value={pastCredits} onChange={setPastCredits} placeholder={tx(
                '請列舉 3-5 個代表案件或客戶,越具體越好(年份、案件類型、語種、規模)。',
                '请列举 3-5 个代表项目或客户,越具体越好(年份、项目类型、语种、规模)。',
                'List 3-5 notable credits or clients — the more specific (year, type, language, scale), the better.'
              )} />
            </Field>
          </Section>

          <Section title={tx('07 聯絡', '07 联络', '07 Contact')} required>
            <Field label="Email" required>
              <Input value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
            </Field>
            <Field label={tx('電話 / WhatsApp / LINE', '电话 / WhatsApp / LINE', 'Phone / WhatsApp / LINE')}>
              <Input value={phone} onChange={setPhone} />
            </Field>
            <Field label={tx('補充說明', '补充说明', 'Notes')}>
              <Textarea value={notes} onChange={setNotes} />
            </Field>
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
