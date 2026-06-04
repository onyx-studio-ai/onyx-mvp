'use client';

/**
 * /apply/proofreader — language proofreader / linguistic QA application.
 *
 * THIS FORM IS DELIBERATELY THE STRICTEST OF THE 4 PARTNER ROUTES.
 *
 * Why: Wing can't natively verify proofreading quality for languages
 * she doesn't speak (Hindi, Tamil, Indonesian, Arabic, etc.). The
 * obvious failure mode is hiring someone who BS's their qualifications
 * — they claim native fluency and certifications, do nothing, and
 * Onyx ships a flawed deliverable to a paying client. Reputation gone.
 *
 * Defense: every credential the applicant claims must be VERIFIABLE by
 * Onyx without speaking the language:
 *
 *   1. LinkedIn URL — REQUIRED (publicly checkable, hard to fake)
 *   2. Certifications — must include issuing body + cert ID (not just
 *      "I have a DipTrans" — must say which body / which year / cert#)
 *   3. Past clients — must list 3+ with project type + year + scale
 *      (specificity is hard to fake; vague claims are a red flag)
 *   4. References — optional but encouraged: name + email of past
 *      client/employer Onyx can contact
 *   5. Public profile URL (university page, ProZ, TranslatorsCafe,
 *      published work URL) — secondary verification
 *   6. Sample test willingness — Onyx may send a paid sample text to
 *      actually evaluate ability. Refusal flags risk.
 *
 * Frontend doesn't block submission on every field but the producer
 * is going to triage hard. The email body groups credentials in a
 * section so a reviewer can scan-and-reject in 30 seconds.
 *
 * Submission: POST /api/contact/send (department=PRODUCTION,
 * source=apply-proofreader).
 */

import { useState, FormEvent } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, CheckCircle2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import Footer from '@/components/landing/Footer';
import { Section, Field, Choices, Pill, Input, Textarea } from '@/components/forms/PartnerFormHelpers';

type Experience = 'less3' | '3to7' | '7to15' | 'over15';
type EducationLevel = 'phd' | 'masters' | 'bachelors' | 'specialized' | 'other';
type SampleTest = 'yes' | 'maybe' | 'no';
type Proficiency = 'native' | 'c2' | 'c1' | 'b2' | 'other';

const LANGS = [
  'Mandarin (TW)', 'Mandarin (CN)', 'Cantonese', 'Hokkien',
  'English (US)', 'English (UK)', 'Japanese', 'Korean',
  'Thai', 'Vietnamese', 'Indonesian', 'Malay', 'Tagalog',
  'Hindi', 'Bengali', 'Tamil', 'Urdu', 'Punjabi',
  'Spanish', 'French', 'German', 'Portuguese', 'Italian',
  'Arabic (MSA)', 'Arabic (Egyptian)', 'Arabic (Gulf)',
  'Russian', 'Polish', 'Turkish', 'Dutch', 'Swedish',
];

const CONTENT_TYPES = [
  'Subtitle / Closed Captions',
  'Dubbing Script',
  'TTS Prompts / Voice-Data Script',
  'Literary Translation',
  'Legal / Contracts',
  'Technical / Engineering',
  'Marketing / Copywriting',
  'e-Learning / Educational',
  'Medical / Pharmaceutical',
  'Game / Interactive',
  'Academic / Research',
];

export default function ApplyProofreaderPage() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  // ---- state -----------------------------------------------------------
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('');
  const [nativeLanguages, setNativeLanguages] = useState<string[]>([]);
  const [workingLanguages, setWorkingLanguages] = useState<string[]>([]);
  const [proficiency, setProficiency] = useState<Proficiency | ''>('');

  const [experience, setExperience] = useState<Experience | ''>('');
  const [educationLevel, setEducationLevel] = useState<EducationLevel | ''>('');
  const [educationField, setEducationField] = useState('');
  const [educationInstitution, setEducationInstitution] = useState('');

  const [certifications, setCertifications] = useState('');
  const [currentEmployer, setCurrentEmployer] = useState('');

  // VERIFIABILITY — these are the spam filters
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [publicProfileUrl, setPublicProfileUrl] = useState('');

  const [contentTypes, setContentTypes] = useState<string[]>([]);

  const [pastClients, setPastClients] = useState('');
  const [referencesText, setReferencesText] = useState('');
  const [sampleWorkUrl, setSampleWorkUrl] = useState('');

  const [hoursPerWeek, setHoursPerWeek] = useState('');
  const [timezone, setTimezone] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [turnaround, setTurnaround] = useState('');

  const [sampleTest, setSampleTest] = useState<SampleTest | ''>('');

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [inquiryNumber, setInquiryNumber] = useState('');

  const toggleNative = (l: string) => setNativeLanguages(p => p.includes(l) ? p.filter(x => x !== l) : [...p, l]);
  const toggleWorking = (l: string) => setWorkingLanguages(p => p.includes(l) ? p.filter(x => x !== l) : [...p, l]);
  const toggleContentType = (t: string) => setContentTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  // ---- labels ----------------------------------------------------------
  const labelFor = {
    experience: (e: Experience): string => ({
      less3:   tx('未滿 3 年',  '未满 3 年',  'Less than 3 years'),
      '3to7':  tx('3-7 年',     '3-7 年',     '3-7 years'),
      '7to15': tx('7-15 年',    '7-15 年',    '7-15 years'),
      over15:  tx('15+ 年',     '15+ 年',     '15+ years'),
    }[e]),
    education: (e: EducationLevel): string => ({
      phd:         tx('博士',           '博士',           'PhD'),
      masters:     tx('碩士',           '硕士',           'Master\'s'),
      bachelors:   tx('學士',           '学士',           'Bachelor\'s'),
      specialized: tx('專業認證 / 文憑', '专业认证 / 文凭', 'Professional certificate / diploma'),
      other:       tx('其他',           '其他',           'Other'),
    }[e]),
    sampleTest: (s: SampleTest): string => ({
      yes:   tx('願意(有償試譯)', '愿意(有偿试译)', 'Yes (paid sample test)'),
      maybe: tx('視情況',           '视情况',           'Depends'),
      no:    tx('不接受',           '不接受',           'No'),
    }[s]),
    proficiency: (p: Proficiency): string => ({
      native: tx('母語水準',  '母语水准',  'Native'),
      c2:     tx('C2 / 接近母語', 'C2 / 接近母语', 'C2 / near-native'),
      c1:     tx('C1 / 流利',  'C1 / 流利',  'C1 / fluent'),
      b2:     tx('B2 / 中高級', 'B2 / 中高级', 'B2 / upper-intermediate'),
      other:  tx('其他(備註說明)', '其他(备注说明)', 'Other (specify in notes)'),
    }[p]),
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
    if (nativeLanguages.length === 0 || workingLanguages.length === 0 || !experience || !educationLevel || !linkedinUrl.trim() || !pastClients.trim()) {
      toast.error(tx(
        '校對 / 語言 QA 必填:母語、工作語種、年資、學歷、LinkedIn URL、過往客戶',
        '校对 / 语言 QA 必填:母语、工作语种、年资、学历、LinkedIn URL、过往客户',
        'Required for proofreader: native langs, working langs, experience, education, LinkedIn URL, past clients'
      ));
      return;
    }

    const lines: string[] = [];
    lines.push(tx('=== 校對 / 語言 QA 申請 ===', '=== 校对 / 语言 QA 申请 ===', '=== Proofreader / Language QA Application ==='));
    lines.push('');

    lines.push(tx('▎ 基本資訊', '▎ 基本资讯', '▎ Basic info'));
    lines.push((tx('  姓名:', '  姓名:', '  Name: ')) + fullName.trim());
    if (country.trim()) lines.push((tx('  國家 / 城市:', '  国家 / 城市:', '  Country / city: ')) + country.trim());
    lines.push((tx('  母語:', '  母语:', '  Native languages: ')) + nativeLanguages.join('、'));
    lines.push((tx('  工作語種:', '  工作语种:', '  Working languages: ')) + workingLanguages.join('、'));
    if (proficiency) lines.push((tx('  工作語種程度:', '  工作语种程度:', '  Working proficiency: ')) + labelFor.proficiency(proficiency as Proficiency));
    lines.push('');

    lines.push(tx('▎ 學經歷', '▎ 学经历', '▎ Education & experience'));
    lines.push((tx('  校對年資:', '  校对年资:', '  Years experience: ')) + labelFor.experience(experience as Experience));
    lines.push((tx('  最高學歷:', '  最高学历:', '  Highest education: ')) + labelFor.education(educationLevel as EducationLevel));
    if (educationField.trim())       lines.push((tx('  專業領域:', '  专业领域:', '  Field: ')) + educationField.trim());
    if (educationInstitution.trim()) lines.push((tx('  畢業 / 任職機構:', '  毕业 / 任职机构:', '  Institution: ')) + educationInstitution.trim());
    if (currentEmployer.trim())      lines.push((tx('  現職:', '  现职:', '  Current employer: ')) + currentEmployer.trim());
    lines.push('');

    if (certifications.trim()) {
      lines.push(tx('▎ 認證(發證單位 + ID + 年份)', '▎ 认证(发证单位 + ID + 年份)', '▎ Certifications (issuing body + ID + year)'));
      certifications.trim().split('\n').forEach(l => lines.push('  • ' + l));
      lines.push('');
    }

    lines.push(tx('▎ 公開資料(用於驗證)', '▎ 公开资料(用于验证)', '▎ Public verification URLs'));
    lines.push((tx('  LinkedIn:', '  LinkedIn:', '  LinkedIn: ')) + linkedinUrl.trim());
    if (publicProfileUrl.trim()) lines.push((tx('  其他公開檔案:', '  其他公开档案:', '  Other public profile: ')) + publicProfileUrl.trim());
    lines.push('');

    if (contentTypes.length > 0) {
      lines.push(tx('▎ 專長類型', '▎ 专长类型', '▎ Content specialization'));
      contentTypes.forEach(c => lines.push('  • ' + c));
      lines.push('');
    }

    lines.push(tx('▎ 過往代表案件 / 客戶', '▎ 过往代表项目 / 客户', '▎ Past notable projects / clients'));
    pastClients.trim().split('\n').forEach(l => lines.push('  ' + l));
    lines.push('');

    if (referencesText.trim()) {
      lines.push(tx('▎ 推薦人(過往客戶 / 雇主聯絡)', '▎ 推荐人(过往客户 / 雇主联络)', '▎ References (past clients / employers contact)'));
      referencesText.trim().split('\n').forEach(l => lines.push('  ' + l));
      lines.push('');
    }

    if (sampleWorkUrl.trim()) {
      lines.push(tx('▎ 樣本作品', '▎ 样本作品', '▎ Sample work'));
      lines.push('  ' + sampleWorkUrl.trim());
      lines.push('');
    }

    if (hoursPerWeek.trim() || timezone.trim() || hourlyRate.trim() || turnaround.trim()) {
      lines.push(tx('▎ 可配合度', '▎ 可配合度', '▎ Availability'));
      if (hoursPerWeek.trim()) lines.push((tx('  每週小時數:', '  每周小时数:', '  Hours / week: ')) + hoursPerWeek.trim());
      if (timezone.trim())     lines.push((tx('  時區:', '  时区:', '  Time zone: ')) + timezone.trim());
      if (hourlyRate.trim())   lines.push((tx('  時薪 / 字數費(USD):', '  时薪 / 字数费(USD):', '  Hourly / per-word rate (USD): ')) + hourlyRate.trim());
      if (turnaround.trim())   lines.push((tx('  典型交期:', '  典型交期:', '  Typical turnaround: ')) + turnaround.trim());
      lines.push('');
    }

    if (sampleTest) {
      lines.push(tx('▎ 有償試譯意願', '▎ 有偿试译意愿', '▎ Paid sample test willingness'));
      lines.push('  ' + labelFor.sampleTest(sampleTest as SampleTest));
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
          source: 'apply-proofreader',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'send failed');
      setInquiryNumber(data.inquiryNumber || '');
      setSent(true);
    } catch (err) {
      toast.error(tx('送出失敗,請稍後再試', '送出失败,请稍后再试', 'Send failed, please retry'));
      console.error('[Apply Proofreader] submit error:', err);
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
                '製作團隊會審核你的資歷與過往案件,3-5 個工作日內以 email 回覆。可能會請你做有償試譯。',
                '制作团队会审核你的资历与过往项目,3-5 个工作日内以 email 回复。可能会请你做有偿试译。',
                "Our team will review your credentials and past work, and reply by email within 3-5 business days. We may request a paid sample test."
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
            {tx('校對 / 語言 QA 申請', '校对 / 语言 QA 申请', 'Proofreader / Language QA Application')}
          </h1>
          <p className="text-gray-400 mb-4">
            {tx(
              '審核時間 3-5 個工作日。我們可能會請你做有償試譯以評估實際能力。',
              '审核时间 3-5 个工作日。我们可能会请你做有偿试译以评估实际能力。',
              "Review takes 3-5 business days. We may request a paid sample test to evaluate actual ability."
            )}
          </p>

          {/* Verification notice — sets expectation upfront */}
          <div className="mt-4 p-4 rounded-xl bg-amber-500/[0.06] border border-amber-300/20 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-300 leading-relaxed">
              {tx(
                'Onyx 對外承接案件的品質責任,要求每位校對人才提供可驗證的資歷:LinkedIn、認證(含發證單位 + ID)、過往案件具體描述。Onyx 會以這些公開資料交叉比對你的陳述。',
                'Onyx 对外承接项目的质量责任,要求每位校对人才提供可验证的资历:LinkedIn、认证(含发证单位 + ID)、过往项目具体描述。Onyx 会以这些公开资料交叉比对你的陈述。',
                "Onyx's quality commitment to clients requires verifiable credentials: LinkedIn, certifications (with issuing body + ID), specific past projects. We cross-check your stated experience against this public record."
              )}
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 pb-24">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-10">

          <Section title={tx('01 基本資訊', '01 基本资讯', '01 Basic info')} required>
            <Field label={tx('姓名', '姓名', 'Full name')} required>
              <Input value={fullName} onChange={setFullName} />
            </Field>
            <Field label={tx('國家 / 城市', '国家 / 城市', 'Country / city')}>
              <Input value={country} onChange={setCountry} />
            </Field>
            <Field label={tx('母語(可複選)', '母语(可复选)', 'Native languages (multi-select)')} required>
              <div className="flex flex-wrap gap-2">
                {LANGS.map(l => (
                  <Pill key={l} active={nativeLanguages.includes(l)} onClick={() => toggleNative(l)} label={l} />
                ))}
              </div>
            </Field>
            <Field label={tx('校對工作語種(可複選)', '校对工作语种(可复选)', 'Working languages (multi-select)')} required>
              <div className="flex flex-wrap gap-2">
                {LANGS.map(l => (
                  <Pill key={l} active={workingLanguages.includes(l)} onClick={() => toggleWorking(l)} label={l} />
                ))}
              </div>
            </Field>
            <Field label={tx('工作語種程度(若非母語)', '工作语种程度(若非母语)', 'Working language proficiency (if not native)')}>
              <Choices value={proficiency} onSelect={v => setProficiency(v as Proficiency)}
                options={(['native','c2','c1','b2','other'] as Proficiency[]).map(k => [k, labelFor.proficiency(k)] as [string, string])} />
            </Field>
          </Section>

          <Section title={tx('02 學經歷', '02 学经历', '02 Education & experience')} required>
            <Field label={tx('校對年資', '校对年资', 'Proofreading experience')} required>
              <Choices value={experience} onSelect={v => setExperience(v as Experience)}
                options={(['less3','3to7','7to15','over15'] as Experience[]).map(k => [k, labelFor.experience(k)] as [string, string])} />
            </Field>
            <Field label={tx('最高學歷', '最高学历', 'Highest education')} required>
              <Choices value={educationLevel} onSelect={v => setEducationLevel(v as EducationLevel)}
                options={(['phd','masters','bachelors','specialized','other'] as EducationLevel[]).map(k => [k, labelFor.education(k)] as [string, string])} />
            </Field>
            <Field label={tx('專業領域', '专业领域', 'Field of study')}>
              <Input value={educationField} onChange={setEducationField} placeholder={tx(
                '例:語言學、翻譯研究、英美文學、...',
                '例:语言学、翻译研究、英美文学、...',
                'e.g. Linguistics, Translation Studies, English Literature, ...'
              )} />
            </Field>
            <Field label={tx('畢業機構', '毕业机构', 'Institution')}>
              <Input value={educationInstitution} onChange={setEducationInstitution} placeholder={tx(
                '大學名稱',
                '大学名称',
                'University name'
              )} />
            </Field>
            <Field label={tx('現職', '现职', 'Current employer / role')}>
              <Input value={currentEmployer} onChange={setCurrentEmployer} placeholder={tx(
                '例:Foo Inc. 譯者 / 自由接案 / Bar 大學講師',
                '例:Foo Inc. 译者 / 自由接案 / Bar 大学讲师',
                'e.g. Translator at Foo Inc. / freelance / lecturer at Bar Uni'
              )} />
            </Field>
          </Section>

          <Section title={tx('03 認證(可選但有助評估)', '03 认证(可选但有助评估)', '03 Certifications (optional but helpful)')} hint={tx(
            '請列出每個認證的:1) 名稱 2) 發證單位 3) 證書編號 / 年份。例:DipTrans / IoLET / 2018 / Cert#12345。模糊的認證(只說「我有 DipTrans」)會被降低權重。',
            '请列出每个认证的:1) 名称 2) 发证单位 3) 证书编号 / 年份。例:DipTrans / IoLET / 2018 / Cert#12345。模糊的认证(只说「我有 DipTrans」)会被降低权重。',
            'For each: 1) name, 2) issuing body, 3) cert ID / year. e.g. DipTrans / IoLET / 2018 / Cert#12345. Vague claims (just "I have DipTrans") are weighted lower.'
          )}>
            <Textarea value={certifications} onChange={setCertifications} rows={5} placeholder={tx(
              'DipTrans / IoLET / 2018 / Cert#12345\nATA Certified Translator / ATA / 2020\n...',
              'DipTrans / IoLET / 2018 / Cert#12345\nATA Certified Translator / ATA / 2020\n...',
              'DipTrans / IoLET / 2018 / Cert#12345\nATA Certified Translator / ATA / 2020\n...'
            )} />
          </Section>

          <Section title={tx('04 公開資料(用於驗證)', '04 公开资料(用于验证)', '04 Public verification URLs')} required hint={tx(
            'Onyx 會交叉比對你提供的學經歷與公開資料。LinkedIn 為必填。',
            'Onyx 会交叉比对你提供的学经历与公开资料。LinkedIn 为必填。',
            'Onyx cross-verifies stated credentials against public records. LinkedIn is required.'
          )}>
            <Field label="LinkedIn URL" required>
              <Input value={linkedinUrl} onChange={setLinkedinUrl} placeholder="https://linkedin.com/in/..." />
            </Field>
            <Field label={tx('其他公開檔案 URL', '其他公开档案 URL', 'Other public profile URL')} hint={tx(
              '例:大學個人頁、ProZ、TranslatorsCafe、出版作品連結、Google Scholar...',
              '例:大学个人页、ProZ、TranslatorsCafe、出版作品链接、Google Scholar...',
              'e.g. university page, ProZ, TranslatorsCafe, published work URL, Google Scholar...'
            )}>
              <Input value={publicProfileUrl} onChange={setPublicProfileUrl} placeholder="https://..." />
            </Field>
          </Section>

          <Section title={tx('05 專長類型(可複選)', '05 专长类型(可复选)', '05 Content specialization (multi-select)')}>
            <div className="flex flex-wrap gap-2">
              {CONTENT_TYPES.map(c => (
                <Pill key={c} active={contentTypes.includes(c)} onClick={() => toggleContentType(c)} label={c} />
              ))}
            </div>
          </Section>

          <Section title={tx('06 過往代表案件 / 客戶', '06 过往代表项目 / 客户', '06 Past notable projects / clients')} required hint={tx(
            '請列出至少 3 個代表案件,每個包含:年份、案件類型、語種、規模(字數 / 時長)、客戶名稱。具體的描述比廣泛的陳述更有說服力。',
            '请列出至少 3 个代表项目,每个包含:年份、项目类型、语种、规模(字数 / 时长)、客户名称。具体的描述比广泛的陈述更有说服力。',
            'List at least 3 notable projects. For each: year, type, language, scale (word count / hours), client. Specificity beats generality.'
          )}>
            <Textarea value={pastClients} onChange={setPastClients} rows={6} placeholder={tx(
              '2023 / Netflix 短劇字幕校對 / 印地語 / 35,000 字 / 客戶:Foo Media\n2022 / 醫療 e-learning 翻譯校對 / 英→印地 / 200 小時 / 客戶:Bar Pharma\n2021 / TTS 訓練資料校對 / 印地語 / 50,000 utterances / 客戶:Baz AI\n...',
              '2023 / Netflix 短剧字幕校对 / 印地语 / 35,000 字 / 客户:Foo Media\n2022 / 医疗 e-learning 翻译校对 / 英→印地 / 200 小时 / 客户:Bar Pharma\n2021 / TTS 训练资料校对 / 印地语 / 50,000 utterances / 客户:Baz AI\n...',
              '2023 / Netflix short-drama subtitle QA / Hindi / 35,000 words / Client: Foo Media\n2022 / Medical e-learning translation QA / EN→HI / 200 hours / Client: Bar Pharma\n2021 / TTS training data QA / Hindi / 50,000 utterances / Client: Baz AI\n...'
            )} />
          </Section>

          <Section title={tx('07 推薦人(選填,加快審核)', '07 推荐人(选填,加快审核)', '07 References (optional, speeds review)')} hint={tx(
            '若有過往客戶 / 雇主願意為你背書,請提供姓名 + Email + 你們的合作關係。Onyx 可能會直接聯繫驗證。',
            '若有过往客户 / 雇主愿意为你背书,请提供姓名 + Email + 你们的合作关系。Onyx 可能会直接联系验证。',
            'If past clients / employers are willing to vouch for you, provide name + email + relationship. Onyx may contact them.'
          )}>
            <Textarea value={referencesText} onChange={setReferencesText} rows={3} placeholder={tx(
              '姓名 / 公司 / Email / 關係\n姓名 / 公司 / Email / 關係',
              '姓名 / 公司 / Email / 关系\n姓名 / 公司 / Email / 关系',
              'Name / Company / Email / Relationship\nName / Company / Email / Relationship'
            )} />
          </Section>

          <Section title={tx('08 樣本作品', '08 样本作品', '08 Sample work')}>
            <Field label={tx('樣本 URL(已出版 / Drive / portfolio)', '样本 URL(已出版 / Drive / portfolio)', 'Sample URL (published / Drive / portfolio)')}>
              <Input value={sampleWorkUrl} onChange={setSampleWorkUrl} placeholder="https://..." />
            </Field>
          </Section>

          <Section title={tx('09 可配合度', '09 可配合度', '09 Availability')}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={tx('每週小時數', '每周小时数', 'Hours / week')}>
                <Input value={hoursPerWeek} onChange={setHoursPerWeek} placeholder={tx('例:15-30 小時', '例:15-30 小时', 'e.g. 15-30 hours')} />
              </Field>
              <Field label={tx('時區', '时区', 'Time zone')}>
                <Input value={timezone} onChange={setTimezone} placeholder="GMT+8 / UTC-5 / ..." />
              </Field>
            </div>
            <Field label={tx('時薪 / 字數費(USD)', '时薪 / 字数费(USD)', 'Hourly rate / per-word rate (USD)')}>
              <Input value={hourlyRate} onChange={setHourlyRate} placeholder={tx('例:$50/小時 或 $0.04/字', '例:$50/小时 或 $0.04/字', 'e.g. $50/hour or $0.04/word')} />
            </Field>
            <Field label={tx('典型交期(1,000 字)', '典型交期(1,000 字)', 'Typical turnaround per 1,000 words')}>
              <Input value={turnaround} onChange={setTurnaround} placeholder={tx('例:1 個工作日 / 48 小時', '例:1 个工作日 / 48 小时', 'e.g. 1 business day / 48 hours')} />
            </Field>
          </Section>

          <Section title={tx('10 有償試譯意願', '10 有偿试译意愿', '10 Paid sample test willingness')} hint={tx(
            'Onyx 可能會以小規模有償試譯(通常 300-500 字)評估你的實際校對能力。願意者通常會優先進入媒合。',
            'Onyx 可能会以小规模有偿试译(通常 300-500 字)评估你的实际校对能力。愿意者通常会优先进入媒合。',
            'Onyx may evaluate via small paid sample test (typically 300-500 words). Willingness prioritizes you in our matching.'
          )}>
            <Choices value={sampleTest} onSelect={v => setSampleTest(v as SampleTest)}
              options={(['yes','maybe','no'] as SampleTest[]).map(k => [k, labelFor.sampleTest(k)] as [string, string])} />
          </Section>

          <Section title={tx('11 聯絡', '11 联络', '11 Contact')} required>
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
