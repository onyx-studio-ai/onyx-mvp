'use client';

/**
 * /data/brief — voice-data intake form.
 *
 * Flow: /data → "Send your voice-data brief" CTA → this form →
 * POST /api/contact/send (department=PRODUCTION, source=data-brief) →
 * producer emails quote within 24h.
 *
 * Why a dedicated form (not /contact): voice-data projects have many
 * orthogonal dimensions (service type, language depth, license scope,
 * audio spec, annotation needs, role). Capturing structurally means
 * the producer can quote on the first reply instead of 4 rounds of
 * email back-and-forth.
 *
 * Section 08 (role/identity) is intentionally neutral on pricing — it
 * captures whether the inquirer is an end-user, agency, or studio so
 * the producer can apply appropriate partner pricing internally. The
 * form does NOT advertise agency discounts publicly to avoid signalling
 * "we cut deals" to direct end-buyers.
 *
 * Pattern mirrors /dubbing/brief: Section / Field / Choices helpers,
 * tx() inline i18n, blue → amber palette swap to match /data brand.
 */

import { useState, FormEvent } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { CheckCircle2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Footer from '@/components/landing/Footer';

type ServiceType = 'tts' | 'cloning' | 'conversational' | 'annotation' | 'other';

type UseCase =
  | 'customerService' | 'chatbot' | 'ttsDeployment'
  | 'contentGen' | 'internalTraining' | 'research' | 'other';

type LicenseScope =
  | 'singleCustomer' | 'multiCustomer' | 'internal' | 'global' | 'perpetual' | 'other';

type LicensePeriod = '1yr' | '3yr' | '5yr' | 'perpetual' | 'other';

type SampleRate = '48k' | '44.1k' | '22k' | 'other';
type BitDepth = '24' | '16' | 'other';

type AnnotationNeed = 'timestamp' | 'transcript' | 'metadata' | 'all';

type Material =
  | 'haveScript' | 'haveReference' | 'fromScratch' | 'haveData' | 'other';

type Role = 'endUser' | 'agency' | 'studio' | 'other';

type Timeline = 'rush' | 'standard' | 'flexible';

const LANGS = [
  { code: 'zh-TW-mandarin', label: { tw: '中文(台灣普通話)', cn: '中文(台湾普通话)', en: 'Mandarin (Taiwan accent)' } },
  { code: 'zh-CN-mandarin', label: { tw: '中文(大陸普通話)', cn: '中文(大陆普通话)', en: 'Mandarin (Mainland accent)' } },
  { code: 'yue-HK',          label: { tw: '粵語(香港)',       cn: '粤语(香港)',       en: 'Cantonese (Hong Kong)' } },
  { code: 'hokkien-TW',      label: { tw: '台語(閩南語)',     cn: '台语(闽南语)',     en: 'Hokkien (Taiwanese)' } },
  { code: 'en-US',           label: { tw: '英文(美)',         cn: '英文(美)',         en: 'English (US)' } },
  { code: 'en-UK',           label: { tw: '英文(英)',         cn: '英文(英)',         en: 'English (UK)' } },
  { code: 'ja',              label: { tw: '日文',             cn: '日文',             en: 'Japanese' } },
  { code: 'ko',              label: { tw: '韓文',             cn: '韩文',             en: 'Korean' } },
  { code: 'th',              label: { tw: '泰文',             cn: '泰文',             en: 'Thai' } },
  { code: 'vi',              label: { tw: '越南文',           cn: '越南文',           en: 'Vietnamese' } },
  { code: 'id',              label: { tw: '印尼文',           cn: '印尼文',           en: 'Indonesian' } },
  { code: 'ms',              label: { tw: '馬來文',           cn: '马来文',           en: 'Malay' } },
  { code: 'tl',              label: { tw: '他加祿文',         cn: '他加禄文',         en: 'Tagalog' } },
  { code: 'hi',              label: { tw: '印地語',           cn: '印地语',           en: 'Hindi' } },
  { code: 'bn',              label: { tw: '孟加拉語',         cn: '孟加拉语',         en: 'Bengali' } },
  { code: 'ta',              label: { tw: '淡米爾語',         cn: '泰米尔语',         en: 'Tamil' } },
  { code: 'es',              label: { tw: '西班牙文',         cn: '西班牙文',         en: 'Spanish' } },
  { code: 'fr',              label: { tw: '法文',             cn: '法文',             en: 'French' } },
  { code: 'de',              label: { tw: '德文',             cn: '德文',             en: 'German' } },
  { code: 'pt',              label: { tw: '葡萄牙文',         cn: '葡萄牙文',         en: 'Portuguese' } },
  { code: 'ar-msa',          label: { tw: '阿拉伯(MSA)',       cn: '阿拉伯(MSA)',       en: 'Arabic (MSA)' } },
  { code: 'other',           label: { tw: '其他(補充說明)',   cn: '其他(补充说明)',   en: 'Other (specify in notes)' } },
];

export default function DataBriefPage() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  // ---- form state ------------------------------------------------------
  const [services, setServices] = useState<ServiceType[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [voiceCount, setVoiceCount] = useState('');
  const [finishedHours, setFinishedHours] = useState('');
  const [utteranceCount, setUtteranceCount] = useState('');
  const [useCase, setUseCase] = useState<UseCase | ''>('');
  const [licenseScope, setLicenseScope] = useState<LicenseScope | ''>('');
  const [licensePeriod, setLicensePeriod] = useState<LicensePeriod | ''>('');
  const [sampleRate, setSampleRate] = useState<SampleRate | ''>('');
  const [bitDepth, setBitDepth] = useState<BitDepth | ''>('');
  const [noProcessing, setNoProcessing] = useState<'yes' | 'no' | ''>('');
  const [annotationNeeds, setAnnotationNeeds] = useState<AnnotationNeed[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [role, setRole] = useState<Role | ''>('');
  const [timeline, setTimeline] = useState<Timeline | ''>('');
  const [notes, setNotes] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [inquiryNumber, setInquiryNumber] = useState('');

  const wantsAnnotation = services.includes('annotation');

  const toggleService = (s: ServiceType) => {
    setServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };
  const toggleLang = (code: string) => {
    setLanguages(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  };
  const toggleAnnotation = (a: AnnotationNeed) => {
    setAnnotationNeeds(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  };
  const toggleMaterial = (m: Material) => {
    setMaterials(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  // ---- labels ----------------------------------------------------------
  const labelFor = {
    lang: (code: string): string => {
      const item = LANGS.find(l => l.code === code);
      if (!item) return code;
      return isZhCN ? item.label.cn : isZh ? item.label.tw : item.label.en;
    },
    service: (s: ServiceType): string => ({
      tts:            tx('TTS 語料製作',          'TTS 语料制作',          'TTS Voice Data'),
      cloning:        tx('Voice Cloning / 聲線克隆','Voice Cloning / 声线克隆','Voice Cloning'),
      conversational: tx('對話 / 情緒語料',        '对话 / 情绪语料',        'Conversational / Emotion Data'),
      annotation:     tx('資料標註與清理',         '资料标注与清理',         'Annotation & Cleaning'),
      other:          tx('其他(備註說明)',         '其他(备注说明)',         'Other (specify in notes)'),
    }[s]),
    useCase: (u: UseCase): string => ({
      customerService:  tx('AI 客服 agent',                  'AI 客服 agent',                  'AI customer-service agent'),
      chatbot:          tx('Chatbot / 對話 AI',              'Chatbot / 对话 AI',              'Chatbot / conversational AI'),
      ttsDeployment:    tx('TTS 部署(品牌語音 / 旁白)',    'TTS 部署(品牌语音 / 旁白)',    'TTS deployment (brand voice / narration)'),
      contentGen:       tx('內容生成 / 影視 / 配音',         '内容生成 / 影视 / 配音',         'Content generation / film / dubbing'),
      internalTraining: tx('內部模型訓練',                  '内部模型训练',                  'Internal model training'),
      research:         tx('學術 / 研究',                   '学术 / 研究',                   'Academic / research'),
      other:            tx('其他(備註說明)',                '其他(备注说明)',                'Other (specify in notes)'),
    }[u]),
    licenseScope: (l: LicenseScope): string => ({
      singleCustomer: tx('單一終端客戶使用',        '单一终端客户使用',        'Single end-customer'),
      multiCustomer:  tx('多終端客戶 / 平台部署',    '多终端客户 / 平台部署',    'Multi-customer / platform deployment'),
      internal:       tx('內部使用 / 不對外',        '内部使用 / 不对外',        'Internal use only'),
      global:         tx('全球部署 / 無客戶數限制',  '全球部署 / 无客户数限制',  'Global deployment / unlimited'),
      perpetual:      tx('永久授權',                '永久授权',                'Perpetual'),
      other:          tx('其他(備註說明)',          '其他(备注说明)',          'Other (specify in notes)'),
    }[l]),
    licensePeriod: (p: LicensePeriod): string => ({
      '1yr':       tx('1 年',                  '1 年',                  '1 year'),
      '3yr':       tx('3 年',                  '3 年',                  '3 years'),
      '5yr':       tx('5 年',                  '5 年',                  '5 years'),
      perpetual:   tx('永久',                  '永久',                  'Perpetual'),
      other:       tx('其他(備註說明)',         '其他(备注说明)',         'Other (specify in notes)'),
    }[p]),
    sampleRate: (s: SampleRate): string => ({
      '48k':   '48 kHz',
      '44.1k': '44.1 kHz',
      '22k':   '22.05 kHz',
      other:   tx('其他(備註說明)', '其他(备注说明)', 'Other (specify in notes)'),
    }[s]),
    bitDepth: (b: BitDepth): string => ({
      '24':  '24-bit',
      '16':  '16-bit',
      other: tx('其他(備註說明)', '其他(备注说明)', 'Other (specify in notes)'),
    }[b]),
    noProcessing: (n: 'yes' | 'no'): string => ({
      yes: tx('Yes — 客戶要求 no-processing(原始錄音,不能 EQ / 壓縮 / 降噪)',
              'Yes — 客户要求 no-processing(原始录音,不能 EQ / 压缩 / 降噪)',
              'Yes — client requires no-processing (raw recording, no EQ / compression / noise reduction)'),
      no:  tx('No — Onyx 可以做標準後製',
              'No — Onyx 可以做标准后制',
              'No — Onyx may apply standard post-production'),
    }[n]),
    annotation: (a: AnnotationNeed): string => ({
      timestamp:  tx('時間軸標註(秒數 / segment)',  '时间轴标注(秒数 / segment)',  'Timestamp annotation (segments / seconds)'),
      transcript: tx('文字校對 / 逐字稿',          '文字校对 / 逐字稿',          'Transcript proofreading'),
      metadata:   tx('Metadata 標註(情緒 / 事件)', 'Metadata 标注(情绪 / 事件)', 'Metadata tagging (emotion / events)'),
      all:        tx('全部',                       '全部',                       'All of the above'),
    }[a]),
    material: (m: Material): string => ({
      haveScript:    tx('已有腳本 / prompts(可提供)',  '已有脚本 / prompts(可提供)',  'Have script / prompts (can provide)'),
      haveReference: tx('已有 reference 聲音 / 模型',    '已有 reference 声音 / 模型',    'Have reference voice / model'),
      haveData:      tx('已有部分語料 / 資料',         '已有部分语料 / 资料',         'Have existing partial data'),
      fromScratch:   tx('從零開始(Onyx 提供腳本)',    '从零开始(Onyx 提供脚本)',    'From scratch (Onyx provides script)'),
      other:         tx('其他(備註說明)',             '其他(备注说明)',             'Other (specify in notes)'),
    }[m]),
    role: (r: Role): string => ({
      endUser: tx('終端買方(End-user / 自己產品用)',
                  '终端买方(End-user / 自己产品用)',
                  'End-user (buying for own product)'),
      agency:  tx('Agency / 製作公司 / Reseller(代客戶詢問)',
                  'Agency / 制作公司 / Reseller(代客户询问)',
                  'Agency / Production company / Reseller'),
      studio:  tx('Studio / 合作夥伴',
                  'Studio / 合作伙伴',
                  'Studio / Partner'),
      other:   tx('其他(備註說明)', '其他(备注说明)', 'Other (specify in notes)'),
    }[r]),
    timeline: (t: Timeline): string => ({
      rush:     tx('加急(2 週內,+30% 費用)',  '加急(2 周内,+30% 费用)',  'Rush (within 2 weeks, +30% fee)'),
      standard: tx('標準(4-8 週)',             '标准(4-8 周)',             'Standard (4-8 weeks)'),
      flexible: tx('彈性',                     '弹性',                     'Flexible'),
    }[t]),
  };

  // ---- submit ----------------------------------------------------------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim()) {
      toast.error(tx('請填姓名 + Email', '请填姓名 + Email', 'Please fill name + email'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error(tx('Email 格式不對', 'Email 格式不对', 'Please enter a valid email'));
      return;
    }
    if (services.length === 0 || languages.length === 0 || !useCase
        || !licenseScope || !licensePeriod || !role || !timeline) {
      toast.error(tx(
        '請填服務類型、語種、用途、授權範圍、授權期間、身份、交期',
        '请填服务类型、语种、用途、授权范围、授权期间、身份、交期',
        'Please fill service type, languages, use case, license scope, license period, role, timeline'
      ));
      return;
    }

    // Build producer email body — labelled sections, skimmable.
    const lines: string[] = [];
    lines.push(tx('=== 語音資料案件需求 ===', '=== 语音资料项目需求 ===', '=== Voice Data Project Brief ==='));
    lines.push('');

    lines.push(tx('▎ 服務類型', '▎ 服务类型', '▎ Service type'));
    services.forEach(s => lines.push('  • ' + labelFor.service(s)));
    lines.push('');

    lines.push(tx('▎ 語種與口音', '▎ 语种与口音', '▎ Languages & accents'));
    languages.forEach(c => lines.push('  • ' + labelFor.lang(c)));
    lines.push('');

    lines.push(tx('▎ 專案規模', '▎ 项目规模', '▎ Project scale'));
    if (voiceCount.trim())     lines.push((tx('  聲音數量(預估):',  '  声音数量(预估):',  '  Voices (est.): ')) + voiceCount.trim());
    if (finishedHours.trim())  lines.push((tx('  完成時數(預估):',  '  完成时数(预估):',  '  Finished hours (est.): ')) + finishedHours.trim());
    if (utteranceCount.trim()) lines.push((tx('  utterance 數(預估):', '  utterance 数(预估):', '  Utterances (est.): ')) + utteranceCount.trim());
    if (!voiceCount.trim() && !finishedHours.trim() && !utteranceCount.trim()) {
      lines.push(tx('  (規模待確認,Onyx 提供建議)',
                    '  (规模待确认,Onyx 提供建议)',
                    '  (Scale TBD — Onyx to advise)'));
    }
    lines.push('');

    lines.push(tx('▎ 用途與授權', '▎ 用途与授权', '▎ Use case & licensing'));
    lines.push((tx('  用途:',         '  用途:',         '  Use case: ')) + labelFor.useCase(useCase as UseCase));
    lines.push((tx('  授權範圍:',     '  授权范围:',     '  License scope: ')) + labelFor.licenseScope(licenseScope as LicenseScope));
    lines.push((tx('  授權期間:',     '  授权期间:',     '  License period: ')) + labelFor.licensePeriod(licensePeriod as LicensePeriod));
    lines.push('');

    if (sampleRate || bitDepth || noProcessing) {
      lines.push(tx('▎ 音檔規格', '▎ 音档规格', '▎ Audio spec'));
      if (sampleRate) lines.push((tx('  採樣率:', '  采样率:', '  Sample rate: ')) + labelFor.sampleRate(sampleRate as SampleRate));
      if (bitDepth)   lines.push((tx('  位元深度:', '  位元深度:', '  Bit depth: ')) + labelFor.bitDepth(bitDepth as BitDepth));
      if (noProcessing) lines.push((tx('  原始錄音要求:', '  原始录音要求:', '  No-processing: ')) + labelFor.noProcessing(noProcessing as 'yes' | 'no'));
      lines.push('');
    }

    if (wantsAnnotation && annotationNeeds.length > 0) {
      lines.push(tx('▎ 標註需求', '▎ 标注需求', '▎ Annotation needs'));
      annotationNeeds.forEach(a => lines.push('  • ' + labelFor.annotation(a)));
      lines.push('');
    }

    if (materials.length > 0) {
      lines.push(tx('▎ 可提供材料', '▎ 可提供材料', '▎ Available materials'));
      materials.forEach(m => lines.push('  • ' + labelFor.material(m)));
      lines.push('');
    }

    lines.push(tx('▎ 詢問者身份', '▎ 询问者身份', '▎ Inquirer role'));
    lines.push('  ' + labelFor.role(role as Role));
    lines.push('');

    lines.push(tx('▎ 交期', '▎ 交期', '▎ Timeline'));
    lines.push('  ' + labelFor.timeline(timeline as Timeline));
    lines.push('');

    if (notes.trim()) {
      lines.push(tx('▎ 補充說明', '▎ 补充说明', '▎ Notes'));
      notes.trim().split('\n').forEach(l => lines.push('  ' + l));
      lines.push('');
    }

    lines.push(tx('▎ 聯絡', '▎ 联络', '▎ Contact'));
    if (company.trim()) lines.push((tx('  公司:', '  公司:', '  Company: ')) + company.trim());
    if (phone.trim())   lines.push((tx('  電話:', '  电话:', '  Phone: ')) + phone.trim());

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
          source: 'data-brief',
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
      console.error('[Data Brief] submit error:', err);
    } finally {
      setSending(false);
    }
  };

  // ---- success state ---------------------------------------------------
  if (sent) {
    return (
      <main className="min-h-screen bg-black text-white">
        <section className="pt-32 pb-20 px-4">
          <div className="max-w-xl mx-auto text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-400 mb-6" />
            <h1 className="text-3xl md:text-4xl font-bold mb-3">
              {tx('需求已收到', '需求已收到', 'Brief received')}
            </h1>
            <p className="text-gray-400 mb-6">
              {tx(
                '製作團隊會在 1 個工作日內以 email 回覆方向與報價。',
                '制作团队会在 1 个工作日内以 email 回复方向与报价。',
                'Our production team will email direction + quote within 1 business day.'
              )}
            </p>
            {inquiryNumber && (
              <div className="inline-block px-4 py-2 rounded-lg bg-white/5 border border-white/10 mb-8">
                <span className="text-gray-400 text-sm mr-2">{tx('參考編號', '参考编号', 'Reference')}:</span>
                <span className="font-mono text-amber-300">{inquiryNumber}</span>
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <Link
                href="/data"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-sm border border-white/10"
              >
                <ArrowLeft className="w-4 h-4" />
                {tx('回語音資料工作室', '回语音资料工作室', 'Back to Voice Data')}
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

  // ---- brief form ------------------------------------------------------
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="pt-28 pb-8 px-4">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/data"
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition mb-6"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {tx('回語音資料工作室', '回语音资料工作室', 'Back to Voice Data')}
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {tx('語音資料案件需求', '语音资料项目需求', 'Voice Data Project Brief')}
          </h1>
          <p className="text-gray-400">
            {tx(
              '送出後 1 個工作日內以 email 回覆方向與報價。',
              '送出后 1 个工作日内以 email 回复方向与报价。',
              'Direction + quote emailed within 1 business day.'
            )}
          </p>
        </div>
      </section>

      <section className="px-4 pb-24">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-10">

          {/* 01 — Service type */}
          <Section
            title={tx('01 服務類型', '01 服务类型', '01 Service type')}
            required
            hint={tx('可複選 — 同一案件常含多種類型。',
                     '可复选 — 同一项目常含多种类型。',
                     'Multi-select — projects often span multiple types.')}
          >
            <div className="flex flex-wrap gap-2">
              {(['tts','cloning','conversational','annotation','other'] as ServiceType[]).map(s => (
                <Pill
                  key={s}
                  active={services.includes(s)}
                  onClick={() => toggleService(s)}
                  label={labelFor.service(s)}
                />
              ))}
            </div>
          </Section>

          {/* 02 — Languages & accents */}
          <Section
            title={tx('02 語種與口音', '02 语种与口音', '02 Languages & accents')}
            required
            hint={tx('可複選。沒列到的小語種請在備註說明。',
                     '可复选。没列到的小语种请在备注说明。',
                     'Multi-select. For other languages, specify in notes.')}
          >
            <div className="flex flex-wrap gap-2">
              {LANGS.map(l => (
                <Pill
                  key={l.code}
                  active={languages.includes(l.code)}
                  onClick={() => toggleLang(l.code)}
                  label={isZhCN ? l.label.cn : isZh ? l.label.tw : l.label.en}
                />
              ))}
            </div>
          </Section>

          {/* 03 — Project scale */}
          <Section
            title={tx('03 專案規模', '03 项目规模', '03 Project scale')}
            hint={tx('如果不確定,留空即可,Onyx 會在報價時建議規模。',
                     '如果不确定,留空即可,Onyx 会在报价时建议规模。',
                     'Leave blank if uncertain — Onyx will advise scale in the quote.')}
          >
            <Field label={tx('聲音數量(預估)', '声音数量(预估)', 'Number of voices (est.)')}>
              <Input value={voiceCount} onChange={setVoiceCount} placeholder={tx('例:6 / 20 / 30+', '例:6 / 20 / 30+', 'e.g. 6 / 20 / 30+')} />
            </Field>
            <Field label={tx('完成時數(預估)', '完成时数(预估)', 'Finished hours (est.)')}>
              <Input value={finishedHours} onChange={setFinishedHours} placeholder={tx('例:3 / 10 / 100 小時', '例:3 / 10 / 100 小时', 'e.g. 3 / 10 / 100 hours')} />
            </Field>
            <Field label={tx('Utterance 數(預估)', 'Utterance 数(预估)', 'Utterances (est.)')}>
              <Input value={utteranceCount} onChange={setUtteranceCount} placeholder={tx('例:1,000 / 10,000 / 不確定', '例:1,000 / 10,000 / 不确定', 'e.g. 1,000 / 10,000 / unsure')} />
            </Field>
          </Section>

          {/* 04 — Use case & licensing */}
          <Section
            title={tx('04 用途與授權', '04 用途与授权', '04 Use case & licensing')}
            required
            hint={tx(
              '這部分直接決定報價結構 — 越窄的授權範圍價格越低。',
              '这部分直接决定报价结构 — 越窄的授权范围价格越低。',
              'This drives the pricing structure — narrower license scope = lower price.'
            )}
          >
            <Field label={tx('用途場景', '用途场景', 'Use case')} required>
              <Choices
                value={useCase}
                onSelect={(v) => setUseCase(v as UseCase)}
                options={(['customerService','chatbot','ttsDeployment','contentGen','internalTraining','research','other'] as UseCase[])
                  .map(k => [k, labelFor.useCase(k)] as [string, string])}
              />
            </Field>
            <Field label={tx('授權範圍', '授权范围', 'License scope')} required>
              <Choices
                value={licenseScope}
                onSelect={(v) => setLicenseScope(v as LicenseScope)}
                options={(['singleCustomer','multiCustomer','internal','global','perpetual','other'] as LicenseScope[])
                  .map(k => [k, labelFor.licenseScope(k)] as [string, string])}
              />
            </Field>
            <Field label={tx('授權期間', '授权期间', 'License period')} required>
              <Choices
                value={licensePeriod}
                onSelect={(v) => setLicensePeriod(v as LicensePeriod)}
                options={(['1yr','3yr','5yr','perpetual','other'] as LicensePeriod[])
                  .map(k => [k, labelFor.licensePeriod(k)] as [string, string])}
              />
            </Field>
          </Section>

          {/* 05 — Audio spec */}
          <Section
            title={tx('05 音檔規格', '05 音档规格', '05 Audio spec')}
            hint={tx('Onyx 預設 48k / 24-bit。若客戶有特殊規格(no-processing 等)請在此標示。',
                     'Onyx 默认 48k / 24-bit。若客户有特殊规格(no-processing 等)请在此标示。',
                     'Onyx defaults to 48k / 24-bit. Note any client-specific requirements (e.g. no-processing).')}
          >
            <Field label={tx('採樣率', '采样率', 'Sample rate')}>
              <Choices
                value={sampleRate}
                onSelect={(v) => setSampleRate(v as SampleRate)}
                options={(['48k','44.1k','22k','other'] as SampleRate[])
                  .map(k => [k, labelFor.sampleRate(k)] as [string, string])}
              />
            </Field>
            <Field label={tx('位元深度', '位元深度', 'Bit depth')}>
              <Choices
                value={bitDepth}
                onSelect={(v) => setBitDepth(v as BitDepth)}
                options={(['24','16','other'] as BitDepth[])
                  .map(k => [k, labelFor.bitDepth(k)] as [string, string])}
              />
            </Field>
            <Field label={tx('原始錄音要求(no-processing)', '原始录音要求(no-processing)', 'No-processing requirement')}>
              <Choices
                value={noProcessing}
                onSelect={(v) => setNoProcessing(v as 'yes' | 'no')}
                options={[
                  ['yes', labelFor.noProcessing('yes')],
                  ['no',  labelFor.noProcessing('no')],
                ]}
              />
            </Field>
          </Section>

          {/* 06 — Annotation (conditional shown when annotation selected,
                  but always visible as optional for everyone else) */}
          <Section
            title={tx('06 標註需求(選填)', '06 标注需求(选填)', '06 Annotation needs (optional)')}
            hint={tx(
              wantsAnnotation
                ? '你選了「標註與清理」 — 請勾選具體要哪幾項。'
                : '如果案件需要 turnkey 含標註處理,請勾選。',
              wantsAnnotation
                ? '你选了「标注与清理」 — 请勾选具体要哪几项。'
                : '如果项目需要 turnkey 含标注处理,请勾选。',
              wantsAnnotation
                ? "You've selected 'Annotation & Cleaning' — specify what you need."
                : 'Check items if you need a turnkey delivery including annotation.'
            )}
          >
            <div className="flex flex-wrap gap-2">
              {(['timestamp','transcript','metadata','all'] as AnnotationNeed[]).map(a => (
                <Pill
                  key={a}
                  active={annotationNeeds.includes(a)}
                  onClick={() => toggleAnnotation(a)}
                  label={labelFor.annotation(a)}
                />
              ))}
            </div>
          </Section>

          {/* 07 — Materials */}
          <Section
            title={tx('07 你能提供的材料(可複選)', '07 你能提供的材料(可复选)', '07 What you can provide (multi-select)')}
          >
            <div className="flex flex-wrap gap-2">
              {(['haveScript','haveReference','haveData','fromScratch','other'] as Material[]).map(m => (
                <Pill
                  key={m}
                  active={materials.includes(m)}
                  onClick={() => toggleMaterial(m)}
                  label={labelFor.material(m)}
                />
              ))}
            </div>
          </Section>

          {/* 08 — Role / identity (neutral pricing — internal classification) */}
          <Section
            title={tx('08 你的身份', '08 你的身份', '08 Your role')}
            required
            hint={tx(
              '這幫助我們依角色提供合適的方案 — Onyx 同時服務終端買方與合作夥伴。',
              '这帮助我们依角色提供合适的方案 — Onyx 同时服务终端买方与合作伙伴。',
              "Helps us tailor the proposal — Onyx serves both end-buyers and partner agencies."
            )}
          >
            <Choices
              value={role}
              onSelect={(v) => setRole(v as Role)}
              options={(['endUser','agency','studio','other'] as Role[])
                .map(k => [k, labelFor.role(k)] as [string, string])}
            />
          </Section>

          {/* 09 — Timeline + contact + notes */}
          <Section
            title={tx('09 時程與聯絡', '09 时程与联络', '09 Timeline & contact')}
            required
          >
            <Field label={tx('交期', '交期', 'Timeline')} required>
              <Choices
                value={timeline}
                onSelect={(v) => setTimeline(v as Timeline)}
                options={(['rush','standard','flexible'] as Timeline[])
                  .map(k => [k, labelFor.timeline(k)] as [string, string])}
              />
            </Field>
            <Field label={tx('補充說明 / 參考', '补充说明 / 参考', 'Notes / references')}>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={4}
                placeholder={tx(
                  '其他你想說明的:特殊規格、目標模型、技術背景、或請列出未在清單中的語種...',
                  '其他你想说明的:特殊规格、目标模型、技术背景、或请列出未在清单中的语种...',
                  'Anything else: special specs, target model, technical background, or list languages not in the picker...'
                )}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-amber-500/60"
              />
            </Field>
            <Field label={tx('姓名', '姓名', 'Name')} required>
              <Input value={name} onChange={setName} placeholder={tx('你的名字', '你的名字', 'Your name')} />
            </Field>
            <Field label="Email" required>
              <Input value={email} onChange={setEmail} type="email" placeholder="you@company.com" />
            </Field>
            <Field label={tx('公司 / 機構', '公司 / 机构', 'Company / Organization')}>
              <Input value={company} onChange={setCompany} placeholder={tx('公司名稱(選填)', '公司名称(选填)', 'Company name (optional)')} />
            </Field>
            <Field label={tx('電話 / WhatsApp / LINE', '电话 / WhatsApp / LINE', 'Phone / WhatsApp / LINE')}>
              <Input value={phone} onChange={setPhone} placeholder={tx('選填,加快回覆', '选填,加快回复', 'Optional, speeds up response')} />
            </Field>
          </Section>

          <div className="pt-2">
            <button
              type="submit"
              disabled={sending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 text-black px-8 py-4 font-semibold hover:bg-amber-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending
                ? tx('送出中…', '送出中…', 'Sending…')
                : tx('送出語音資料需求', '送出语音资料需求', 'Submit voice-data brief')}
            </button>
            <p className="text-xs text-gray-500 text-center mt-3">
              {tx(
                '送出後將以 email 通知,1 個工作日內回覆。',
                '送出后将以 email 通知,1 个工作日内回复。',
                "You'll receive an email confirmation. Quote within 1 business day."
              )}
            </p>
          </div>

        </form>
      </section>

      <Footer />
    </main>
  );
}

// ---- helpers (Section / Field / Choices / Pill / Input) ---------------

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
          {required && <span className="text-amber-400 ml-1">*</span>}
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

function Pill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm border transition ${
        active ? 'bg-amber-500 text-black border-amber-500'
               : 'bg-white/5 text-gray-300 border-white/10 hover:border-white/30'
      }`}
    >
      {label}
    </button>
  );
}

function Input({
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-amber-500/60"
    />
  );
}
