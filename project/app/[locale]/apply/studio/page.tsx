'use client';

/**
 * /apply/studio — recording-studio partnership application.
 *
 * Onyx prefers studio partnerships over individual freelancer talents
 * because studios are operationally simpler (one invoice, one quality
 * baseline, local recording for stability). This form captures what
 * the producer needs to assess whether a studio meets the TTS-grade
 * baseline (48k / 24-bit / -70 dBFS noise floor / acoustically treated).
 *
 * Submission: POST /api/contact/send (department=PRODUCTION,
 * source=apply-studio). Producer reviews and replies within 3-5 days.
 */

import { useState, FormEvent } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import Footer from '@/components/landing/Footer';
import { Section, Field, Choices, Pill, Input, Textarea } from '@/components/forms/PartnerFormHelpers';
import { PARTNER_LANGS, langLabel } from '@/components/forms/PartnerFormLangs';

type NoiseFloor = 'better70' | 'b6070' | 'b5060' | 'worse50' | 'unsure';
type RoomTreatment = 'fullyTreated' | 'partiallyTreated' | 'basicAcoustic' | 'untreated';
type SampleSpec = 'yes48k24' | 'no48k24' | 'unsure';
type DirectorOnSite = 'inHouse' | 'contract' | 'none';
type LongForm = 'yes' | 'no' | 'depends';

// Studio language subset — same shape as director's (a studio that
// records languages they have local talent for; broader European /
// Arabic variants live in the proofreader form).
const LANG_IDS = [
  'mandarin-tw', 'mandarin-cn', 'cantonese', 'hokkien',
  'en-us', 'en-uk', 'ja', 'ko',
  'th', 'vi', 'id', 'ms', 'tl',
  'hi', 'bn', 'ta', 'ur',
  'es', 'fr', 'de', 'pt', 'it',
  'ar-msa', 'ru',
];
const COMMON_LANGS = PARTNER_LANGS.filter(l => LANG_IDS.includes(l.id));

export default function ApplyStudioPage() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  // ---- state -----------------------------------------------------------
  const [studioName, setStudioName] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [website, setWebsite] = useState('');
  const [yearsOperating, setYearsOperating] = useState('');

  const [rooms, setRooms] = useState('');
  const [roomTreatment, setRoomTreatment] = useState<RoomTreatment | ''>('');
  const [noiseFloor, setNoiseFloor] = useState<NoiseFloor | ''>('');
  const [sampleSpec, setSampleSpec] = useState<SampleSpec | ''>('');

  const [micGear, setMicGear] = useState('');
  const [interfaceGear, setInterfaceGear] = useState('');
  const [dawSoftware, setDawSoftware] = useState('');

  const [languages, setLanguages] = useState<string[]>([]);
  const [talentNetwork, setTalentNetwork] = useState('');

  const [directorOnSite, setDirectorOnSite] = useState<DirectorOnSite | ''>('');
  const [longForm, setLongForm] = useState<LongForm | ''>('');

  const [hourlyRate, setHourlyRate] = useState('');
  const [paymentMethods, setPaymentMethods] = useState('');

  const [sampleWorkUrl, setSampleWorkUrl] = useState('');

  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [inquiryNumber, setInquiryNumber] = useState('');

  const toggleLang = (l: string) => {
    setLanguages(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);
  };

  // ---- labels ----------------------------------------------------------
  const labelFor = {
    treatment: (t: RoomTreatment): string => ({
      fullyTreated:      tx('完全聲學處理(專業隔音 + 吸音)',  '完全声学处理(专业隔音 + 吸音)',  'Fully treated (pro isolation + absorption)'),
      partiallyTreated:  tx('部分處理',                       '部分处理',                       'Partially treated'),
      basicAcoustic:     tx('基礎(吸音材 / 軟裝)',           '基础(吸音材 / 软装)',           'Basic acoustic (foam / soft furnishings)'),
      untreated:         tx('未處理',                         '未处理',                         'Untreated'),
    }[t]),
    noiseFloor: (n: NoiseFloor): string => ({
      better70: tx('優於 -70 dBFS', '优于 -70 dBFS', 'Better than -70 dBFS'),
      b6070:    '-60 to -70 dBFS',
      b5060:    '-50 to -60 dBFS',
      worse50:  tx('差於 -50 dBFS', '差于 -50 dBFS', 'Worse than -50 dBFS'),
      unsure:   tx('不確定 / 需測量', '不确定 / 需测量', 'Unsure / need to measure'),
    }[n]),
    sampleSpec: (s: SampleSpec): string => ({
      yes48k24: tx('可以(48 kHz / 24-bit)',  '可以(48 kHz / 24-bit)',  'Yes (48 kHz / 24-bit)'),
      no48k24:  tx('不可,只能較低規格',     '不可,只能较低规格',     'No, lower spec only'),
      unsure:   tx('需確認設備',             '需确认设备',             'Need to check gear'),
    }[s]),
    directorOnSite: (d: DirectorOnSite): string => ({
      inHouse:  tx('內部聲音導演',           '内部声音导演',           'In-house session director'),
      contract: tx('合作導演(外部)',        '合作导演(外部)',        'Contracted (external) director'),
      none:     tx('無 / 客戶端自帶',         '无 / 客户端自带',         'None / client brings their own'),
    }[d]),
    longForm: (l: LongForm): string => ({
      yes:     tx('可以(3+ 小時 directed session)', '可以(3+ 小时 directed session)', 'Yes (3+ hour directed sessions)'),
      no:      tx('不太能',                         '不太能',                         'Not really'),
      depends: tx('看案件',                         '看项目',                         'Case by case'),
    }[l]),
  };

  // ---- submit ----------------------------------------------------------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!contactName.trim() || !email.trim() || !studioName.trim()) {
      toast.error(tx('請填錄音室名稱 / 聯絡人 / Email', '请填录音室名称 / 联系人 / Email', 'Please fill studio name / contact / email'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error(tx('Email 格式不對', 'Email 格式不对', 'Please enter a valid email'));
      return;
    }
    if (!country.trim() || languages.length === 0 || !roomTreatment || !noiseFloor || !sampleSpec) {
      toast.error(tx(
        '請填國家、可錄語種、聲學處理、底噪、48k/24-bit 能力',
        '请填国家、可录语种、声学处理、底噪、48k/24-bit 能力',
        'Please fill country, languages, room treatment, noise floor, 48k/24-bit capability'
      ));
      return;
    }

    const lines: string[] = [];
    lines.push(tx('=== 錄音室合作申請 ===', '=== 录音室合作申请 ===', '=== Studio Partnership Application ==='));
    lines.push('');

    lines.push(tx('▎ 錄音室基本資訊', '▎ 录音室基本资讯', '▎ Studio info'));
    lines.push((tx('  名稱:', '  名称:', '  Name: ')) + studioName.trim());
    lines.push((tx('  國家:', '  国家:', '  Country: ')) + country.trim());
    if (city.trim())          lines.push((tx('  城市:', '  城市:', '  City: ')) + city.trim());
    if (website.trim())       lines.push((tx('  網站:', '  网站:', '  Website: ')) + website.trim());
    if (yearsOperating.trim()) lines.push((tx('  營運年資:', '  营运年资:', '  Years operating: ')) + yearsOperating.trim());
    lines.push('');

    lines.push(tx('▎ 錄音規格', '▎ 录音规格', '▎ Recording specs'));
    if (rooms.trim()) lines.push((tx('  錄音間數:', '  录音间数:', '  Recording rooms: ')) + rooms.trim());
    lines.push((tx('  聲學處理:', '  声学处理:', '  Room treatment: ')) + labelFor.treatment(roomTreatment as RoomTreatment));
    lines.push((tx('  底噪:', '  底噪:', '  Noise floor: ')) + labelFor.noiseFloor(noiseFloor as NoiseFloor));
    lines.push((tx('  48k / 24-bit 能力:', '  48k / 24-bit 能力:', '  48k / 24-bit capability: ')) + labelFor.sampleSpec(sampleSpec as SampleSpec));
    lines.push('');

    if (micGear.trim() || interfaceGear.trim() || dawSoftware.trim()) {
      lines.push(tx('▎ 設備', '▎ 设备', '▎ Equipment'));
      if (micGear.trim())       lines.push((tx('  麥克風:', '  麦克风:', '  Microphones: ')) + micGear.trim());
      if (interfaceGear.trim()) lines.push((tx('  Interface:', '  Interface:', '  Audio interface: ')) + interfaceGear.trim());
      if (dawSoftware.trim())   lines.push((tx('  DAW:', '  DAW:', '  DAW: ')) + dawSoftware.trim());
      lines.push('');
    }

    lines.push(tx('▎ 可錄語種', '▎ 可录语种', '▎ Languages'));
    languages.forEach(id => lines.push('  • ' + langLabel(id, locale)));
    if (talentNetwork.trim()) {
      lines.push((tx('  人才網絡規模:', '  人才网络规模:', '  Talent network: ')) + talentNetwork.trim());
    }
    lines.push('');

    if (directorOnSite || longForm) {
      lines.push(tx('▎ 製作能力', '▎ 制作能力', '▎ Production capability'));
      if (directorOnSite) lines.push((tx('  聲音導演:', '  声音导演:', '  Session director: ')) + labelFor.directorOnSite(directorOnSite as DirectorOnSite));
      if (longForm)       lines.push((tx('  長時數 session:', '  长时数 session:', '  Long-form sessions: ')) + labelFor.longForm(longForm as LongForm));
      lines.push('');
    }

    if (hourlyRate.trim() || paymentMethods.trim()) {
      lines.push(tx('▎ 商務', '▎ 商务', '▎ Commercial'));
      if (hourlyRate.trim())      lines.push((tx('  時薪(USD):', '  时薪(USD):', '  Hourly rate (USD): ')) + hourlyRate.trim());
      if (paymentMethods.trim())  lines.push((tx('  付款方式:', '  付款方式:', '  Payment methods: ')) + paymentMethods.trim());
      lines.push('');
    }

    if (sampleWorkUrl.trim()) {
      lines.push(tx('▎ 樣本工作', '▎ 样本工作', '▎ Sample work'));
      lines.push('  ' + sampleWorkUrl.trim());
      lines.push('');
    }

    if (notes.trim()) {
      lines.push(tx('▎ 備註', '▎ 备注', '▎ Notes'));
      notes.trim().split('\n').forEach(l => lines.push('  ' + l));
      lines.push('');
    }

    lines.push(tx('▎ 聯絡', '▎ 联络', '▎ Contact'));
    lines.push((tx('  聯絡人:', '  联络人:', '  Contact: ')) + contactName.trim());
    if (phone.trim()) lines.push((tx('  電話 / WhatsApp / LINE:', '  电话 / WhatsApp / LINE:', '  Phone / WA / LINE: ')) + phone.trim());

    const messageBody = lines.join('\n');

    setSending(true);
    try {
      const res = await fetch('/api/contact/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactName.trim(),
          email: email.trim(),
          message: messageBody,
          department: 'PRODUCTION',
          source: 'apply-studio',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'send failed');
      setInquiryNumber(data.inquiryNumber || '');
      setSent(true);
    } catch (err) {
      toast.error(tx('送出失敗,請稍後再試', '送出失败,请稍后再试', 'Send failed, please retry'));
      console.error('[Apply Studio] submit error:', err);
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
            {tx('錄音室合作申請', '录音室合作申请', 'Studio Partnership Application')}
          </h1>
          <p className="text-gray-400">
            {tx(
              '審核時間 3-5 個工作日。錄音室合作要求達到 TTS 級規格(48k / 24-bit / -70 dBFS 底噪)。',
              '审核时间 3-5 个工作日。录音室合作要求达到 TTS 级规格(48k / 24-bit / -70 dBFS 底噪)。',
              'Review takes 3-5 business days. Studios must meet TTS-grade specs (48k / 24-bit / -70 dBFS noise floor).'
            )}
          </p>
        </div>
      </section>

      <section className="px-4 pb-24">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-10">

          <Section title={tx('錄音室基本資訊', '录音室基本资讯', 'Studio info')} required>
            <Field label={tx('錄音室名稱', '录音室名称', 'Studio name')} required>
              <Input value={studioName} onChange={setStudioName} placeholder="SONICNEST / Studio Foo / ..." />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={tx('國家', '国家', 'Country')} required>
                <Input value={country} onChange={setCountry} placeholder={tx('例:台灣 / 印尼 / 印度', '例:台湾 / 印尼 / 印度', 'e.g. Taiwan / Indonesia / India')} />
              </Field>
              <Field label={tx('城市', '城市', 'City')}>
                <Input value={city} onChange={setCity} placeholder={tx('例:台北 / 雅加達', '例:台北 / 雅加达', 'e.g. Taipei / Jakarta')} />
              </Field>
            </div>
            <Field label={tx('網站 / Portfolio URL', '网站 / Portfolio URL', 'Website / Portfolio URL')}>
              <Input value={website} onChange={setWebsite} placeholder="https://..." />
            </Field>
            <Field label={tx('營運年資', '营运年资', 'Years operating')}>
              <Input value={yearsOperating} onChange={setYearsOperating} placeholder={tx('例:8 年', '例:8 年', 'e.g. 8 years')} />
            </Field>
          </Section>

          <Section title={tx('錄音規格', '录音规格', 'Recording specs')} required hint={tx(
            'Onyx 對外承接 AI 語音資料案件,客戶端最低要求是 48k / 24-bit / -70 dBFS 底噪。',
            'Onyx 对外承接 AI 语音资料项目,客户端最低要求是 48k / 24-bit / -70 dBFS 底噪。',
            "Onyx's AI voice-data clients require minimum 48k / 24-bit / -70 dBFS noise floor."
          )}>
            <Field label={tx('錄音間數', '录音间数', 'Number of recording rooms')}>
              <Input value={rooms} onChange={setRooms} placeholder={tx('例:2 間', '例:2 间', 'e.g. 2 rooms')} />
            </Field>
            <Field label={tx('聲學處理程度', '声学处理程度', 'Acoustic treatment')} required>
              <Choices value={roomTreatment} onSelect={v => setRoomTreatment(v as RoomTreatment)}
                options={(['fullyTreated','partiallyTreated','basicAcoustic','untreated'] as RoomTreatment[]).map(k => [k, labelFor.treatment(k)] as [string, string])} />
            </Field>
            <Field label={tx('底噪水平', '底噪水平', 'Noise floor')} required>
              <Choices value={noiseFloor} onSelect={v => setNoiseFloor(v as NoiseFloor)}
                options={(['better70','b6070','b5060','worse50','unsure'] as NoiseFloor[]).map(k => [k, labelFor.noiseFloor(k)] as [string, string])} />
            </Field>
            <Field label={tx('48 kHz / 24-bit 錄音能力', '48 kHz / 24-bit 录音能力', '48 kHz / 24-bit recording capability')} required>
              <Choices value={sampleSpec} onSelect={v => setSampleSpec(v as SampleSpec)}
                options={(['yes48k24','no48k24','unsure'] as SampleSpec[]).map(k => [k, labelFor.sampleSpec(k)] as [string, string])} />
            </Field>
          </Section>

          <Section title={tx('設備', '设备', 'Equipment')}>
            <Field label={tx('麥克風(廠牌 / 型號)', '麦克风(厂牌 / 型号)', 'Microphones (brand / model)')}>
              <Input value={micGear} onChange={setMicGear} placeholder={tx('例:Neumann U87 / Sony C800G / ...', '例:Neumann U87 / Sony C800G / ...', 'e.g. Neumann U87 / Sony C800G / ...')} />
            </Field>
            <Field label={tx('Audio Interface / Preamp', 'Audio Interface / Preamp', 'Audio Interface / Preamp')}>
              <Input value={interfaceGear} onChange={setInterfaceGear} placeholder={tx('例:Apogee Symphony / UAD Apollo / ...', '例:Apogee Symphony / UAD Apollo / ...', 'e.g. Apogee Symphony / UAD Apollo / ...')} />
            </Field>
            <Field label={tx('DAW 軟體', 'DAW 软件', 'DAW software')}>
              <Input value={dawSoftware} onChange={setDawSoftware} placeholder="Pro Tools / Logic Pro / Cubase / Reaper / ..." />
            </Field>
          </Section>

          <Section title={tx('可錄語種 / 在地人才網絡', '可录语种 / 在地人才网络', 'Languages / local talent network')} required>
            <Field label={tx('可錄製語種(可複選)', '可录制语种(可复选)', 'Languages you can record (multi-select)')} required>
              <div className="flex flex-wrap gap-2">
                {COMMON_LANGS.map(l => (
                  <Pill key={l.id} active={languages.includes(l.id)} onClick={() => toggleLang(l.id)} label={langLabel(l.id, locale)} />
                ))}
              </div>
            </Field>
            <Field label={tx('在地人才網絡規模', '在地人才网络规模', 'Local talent network size')}>
              <Input value={talentNetwork} onChange={setTalentNetwork} placeholder={tx('例:50+ 配音員 / 30 名常合作 / ...', '例:50+ 配音员 / 30 名常合作 / ...', 'e.g. 50+ talents / 30 regular collaborators / ...')} />
            </Field>
          </Section>

          <Section title={tx('製作能力', '制作能力', 'Production capability')}>
            <Field label={tx('聲音導演', '声音导演', 'Session director')}>
              <Choices value={directorOnSite} onSelect={v => setDirectorOnSite(v as DirectorOnSite)}
                options={(['inHouse','contract','none'] as DirectorOnSite[]).map(k => [k, labelFor.directorOnSite(k)] as [string, string])} />
            </Field>
            <Field label={tx('長時數 directed session(3+ 小時)', '长时数 directed session(3+ 小时)', 'Long-form directed sessions (3+ hours)')}>
              <Choices value={longForm} onSelect={v => setLongForm(v as LongForm)}
                options={(['yes','no','depends'] as LongForm[]).map(k => [k, labelFor.longForm(k)] as [string, string])} />
            </Field>
          </Section>

          <Section title={tx('商務', '商务', 'Commercial')}>
            <Field
              label={tx('錄音室時薪(USD per recording hour)', '录音室时薪(USD per recording hour)', 'Studio hourly rate (USD per recording hour)')}
              hint={tx(
                '錄音室每小時的收費(不含配音員費),用於評估錄音成本。',
                '录音室每小时的收费(不含配音员费),用于评估录音成本。',
                'Per-hour cost of using your studio (not including talent fee). Used to scope production cost.'
              )}
            >
              <Input value={hourlyRate} onChange={setHourlyRate} placeholder={tx('例:$50-80 / hr', '例:$50-80 / hr', 'e.g. $50-80 / hr')} />
            </Field>
            <Field label={tx('付款方式', '付款方式', 'Payment methods')}>
              <Input value={paymentMethods} onChange={setPaymentMethods} placeholder={tx('例:Wire / PayPal / Wise / ...', '例:Wire / PayPal / Wise / ...', 'e.g. Wire / PayPal / Wise / ...')} />
            </Field>
          </Section>

          <Section
            title={tx('樣本與測試錄音', '样本与测试录音', 'Samples & test recording')}
            hint={tx(
              '請依 Onyx 的測試規格錄製一段測試音檔 — 我們的製作團隊會以此評估你的錄音室是否符合 TTS 級交付標準。',
              '请依 Onyx 的测试规格录制一段测试音档 — 我们的制作团队会以此评估你的录音室是否符合 TTS 级交付标准。',
              "Please record a test clip following the Onyx test spec — our production team uses this to evaluate whether your studio meets the TTS-grade delivery standard."
            )}
          >
            <div className="rounded-xl bg-amber-500/[0.06] border border-amber-300/20 px-4 py-3">
              <p className="text-xs text-gray-300 leading-relaxed">
                {tx('測試錄音請依規格錄製: ', '测试录音请依规格录制: ', 'Record the test clip following the spec: ')}
                <Link href="/apply/studio/test-spec" className="text-amber-300 hover:text-amber-200 underline font-medium">
                  {tx('看 Onyx 錄音室測試規格', '看 Onyx 录音室测试规格', 'see Onyx Studio Test Spec')}
                </Link>
                {tx(
                  '。48 kHz / 24-bit / mono · 無後製 · 含人聲 + room tone + 拍手三段,合併為單一 .wav 檔。',
                  '。48 kHz / 24-bit / mono · 无后制 · 含人声 + room tone + 拍手三段,合并为单一 .wav 档。',
                  '. 48 kHz / 24-bit / mono · no processing · speech + room tone + clap test combined into one .wav file.'
                )}
              </p>
            </div>
            <Field label={tx('測試錄音 URL', '测试录音 URL', 'Test recording URL')}>
              <Input value={sampleWorkUrl} onChange={setSampleWorkUrl} placeholder="https://..." />
            </Field>
          </Section>

          <Section title={tx('聯絡', '联络', 'Contact')} required>
            <Field label={tx('聯絡人姓名', '联络人姓名', 'Contact name')} required>
              <Input value={contactName} onChange={setContactName} placeholder={tx('你的名字', '你的名字', 'Your name')} />
            </Field>
            <Field label="Email" required>
              <Input value={email} onChange={setEmail} type="email" placeholder="you@studio.com" />
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
              <Textarea value={notes} onChange={setNotes} placeholder={tx('其他想說明的:特殊規格、合作經歷、...', '其他想说明的:特殊规格、合作经历、...', 'Anything else: special specs, past collaborations, ...')} />
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
