'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { Loader2, ShieldCheck, Languages, Mic2, Clapperboard, AudioWaveform, CheckCircle2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import Footer from '@/components/landing/Footer';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type FormState = {
  name: string;
  email: string;
  company: string;
  contentType: string;
  sourceLanguage: string;
  targetLanguages: string[];
  needLipSync: string;
  keepOriginalVoice: string;
  duration: string;
  speakers: string;
  timeline: string;
  budgetRange: string;
  videoLinks: string[];
  notes: string;
};

export default function DubbingPage() {
  const locale = useLocale();
  const isZhTW = locale === 'zh-TW';
  const isZhCN = locale === 'zh-CN';
  const isEnglish = locale === 'en';

  const copy = useMemo(() => {
    if (isZhTW) {
      return {
        studioBadge: 'DUBBING STUDIO',
        title: '全球 AI 原聲配音',
        heroSlogan: 'AI 負責效率 我們負責品質',
        subtitle: '多語翻譯、原聲保留、唇形同步一次完成。',
        qualityLine: '人類再修正翻譯、語氣、節奏與咬字，確保成品自然可用。',
        capabilityTitle: '我們會做什麼',
        capabilityItems: [
          '影片多語翻譯與在地化',
          '保留原演員聲線特徵',
          '多語唇形同步',
          '多人角色聲音辨識',
          '異常音與雜訊清理',
          '最終混音與交付整合',
        ],
        workflowTitle: '交付流程',
        workflowItems: [
          '收到影片與需求，先做可行性檢查',
          'AI 生成多語初版（含對嘴）',
          '人類聲音導演修正翻譯與口條',
          '完成音訊清理、合成與最終交付',
        ],
        trustTitle: '素材安全說明',
        trustBody:
          '你提供的影片與素材僅用於本次專案製作與內部技術處理，不會對外公開、轉售或用於未經授權的用途。',
        faqTitle: '常見問題 FAQ',
        faqItems: [
          {
            q: '你們的全球 AI 配音服務包含什麼？',
            a: '包含多語翻譯、原聲保留、唇形同步、聲音清理與最終合成交付。',
          },
          {
            q: '可以保留原演員聲音嗎？',
            a: '可以。我們可在目標語言中盡量保留原角色聲線特徵。',
          },
          {
            q: '多人對白或影集內容也可以處理嗎？',
            a: '可以，支援多人角色辨識與分段處理。',
          },
          {
            q: '你們會怎麼做品質把關？',
            a: 'AI 先生成初版，人類聲音導演再修正翻譯、語氣、節奏與咬字。',
          },
          {
            q: '素材會不會外流？',
            a: '不會，素材僅供本案內部處理與交付使用。',
          },
        ],
        formTitle: '需求引導表單',
        formSubtitle: '以選單為主，快速填完，減少來回溝通時間。',
        openForm: '開始需求引導',
        requiredHint: '先填必填資料，其他細節可再補充。',
        requiredSection: '必填資料',
        optionalSection: '其他專案資訊（選填）',
        selectPlaceholder: '請選擇',
        name: '聯絡人姓名',
        email: 'Email',
        company: '公司 / 品牌',
        contentType: '內容類型',
        sourceLanguage: '來源語言',
        targetLanguages: '目標語言（可複選）',
        targetLanguagesSelect: '請選擇目標語言',
        addLanguage: '加入語言',
        selectedLanguages: '已選語言',
        targetLanguageOptions: [
          '英文',
          '繁體中文',
          '簡體中文',
          '日文',
          '韓文',
          '西班牙文',
          '法文',
          '德文',
          '葡萄牙文',
          '義大利文',
          '俄文',
          '土耳其文',
          '阿拉伯文',
          '印地文',
          '烏爾都文',
          '孟加拉文',
          '泰文',
          '越南文',
          '印尼文',
          '馬來文',
          '波蘭文',
          '荷蘭文',
          '瑞典文',
          '丹麥文',
          '挪威文',
        ],
        needLipSync: '是否需要唇形同步',
        keepOriginalVoice: '是否保留原聲線',
        duration: '預估片長',
        durationOptions: ['5 分鐘以下', '5 - 15 分鐘', '15 - 30 分鐘', '30 - 60 分鐘', '60 分鐘以上'],
        speakers: '角色數量',
        speakerOptions: ['1 位', '2 - 3 位', '4 - 6 位', '7 位以上'],
        timeline: '預計時程',
        timelineOptions: ['72 小時內', '1 週內', '2 週內', '彈性安排'],
        budgetRange: '預算區間（USD）',
        budgetRangeOptions: ['3,000 以下', '3,000 - 10,000', '10,000 - 30,000', '30,000 以上'],
        videoLinks: '影片連結（可新增多筆）',
        videoLinkPlaceholder: 'https://drive.google.com/... 或 https://youtube.com/...',
        addVideoLink: '新增連結',
        removeLink: '移除',
        notes: '補充說明',
        contentTypeOptions: ['影集 / 劇集', '短劇', '教學 / 課程', '企業 / 品牌影片', '廣告', '其他'],
        otherOption: '其他',
        yes: '是',
        no: '否',
        submit: '送出需求',
        submitting: '送出中...',
        submitted: '已收到你的需求',
        submittedDesc: '我們會依需求內容回覆可行方案與時程建議。',
        inquiryNo: '參考編號',
        successToast: '需求已送出',
        failToast: '送出失敗，請稍後再試',
        requiredToast: '請先填寫姓名、Email、公司、內容類型，並至少提供一個影片連結',
      };
    }

    if (isZhCN) {
      return {
        studioBadge: 'DUBBING STUDIO',
        title: '全球 AI 原声配音',
        heroSlogan: 'AI 负责效率 我们负责品质',
        subtitle: '多语翻译、原声保留、唇形同步一次完成。',
        qualityLine: '人类再修正翻译、语气、节奏与咬字，确保成品自然可用。',
        capabilityTitle: '我们会做什么',
        capabilityItems: [
          '视频多语翻译与本地化',
          '保留原演员声线特征',
          '多语唇形同步',
          '多人角色声音识别',
          '异常音与噪音清理',
          '最终混音与交付整合',
        ],
        workflowTitle: '交付流程',
        workflowItems: [
          '收到视频与需求，先做可行性检查',
          'AI 生成多语初版（含对嘴）',
          '人类声音导演修正翻译与口条',
          '完成音频清理、合成与最终交付',
        ],
        trustTitle: '素材安全说明',
        trustBody:
          '你提供的视频与素材仅用于本次项目制作与内部技术处理，不会对外公开、转售或用于未经授权的用途。',
        faqTitle: '常见问题 FAQ',
        faqItems: [
          {
            q: '你们的全球 AI 配音服务包含什么？',
            a: '包含多语翻译、原声保留、唇形同步、声音清理与最终合成交付。',
          },
          {
            q: '可以保留原演员声音吗？',
            a: '可以。我们可在目标语言中尽量保留原角色声线特征。',
          },
          {
            q: '多人对白或剧集内容也可以处理吗？',
            a: '可以，支持多人角色识别与分段处理。',
          },
          {
            q: '你们如何做品质把关？',
            a: 'AI 先生成初版，人类声音导演再修正翻译、语气、节奏与咬字。',
          },
          {
            q: '素材会不会外流？',
            a: '不会，素材仅供本案内部处理与交付使用。',
          },
        ],
        formTitle: '需求引导表单',
        formSubtitle: '以选单为主，快速填完，减少来回沟通时间。',
        openForm: '开始需求引导',
        requiredHint: '先填必填资料，其它细节可再补充。',
        requiredSection: '必填资料',
        optionalSection: '其它项目资讯（选填）',
        selectPlaceholder: '请选择',
        name: '联系人姓名',
        email: 'Email',
        company: '公司 / 品牌',
        contentType: '内容类型',
        sourceLanguage: '来源语言',
        targetLanguages: '目标语言（可多选）',
        targetLanguagesSelect: '请选择目标语言',
        addLanguage: '加入语言',
        selectedLanguages: '已选语言',
        targetLanguageOptions: [
          '英文',
          '繁体中文',
          '简体中文',
          '日文',
          '韩文',
          '西班牙文',
          '法文',
          '德文',
          '葡萄牙文',
          '意大利文',
          '俄文',
          '土耳其文',
          '阿拉伯文',
          '印地文',
          '乌尔都文',
          '孟加拉文',
          '泰文',
          '越南文',
          '印尼文',
          '马来文',
          '波兰文',
          '荷兰文',
          '瑞典文',
          '丹麦文',
          '挪威文',
        ],
        needLipSync: '是否需要唇形同步',
        keepOriginalVoice: '是否保留原声线',
        duration: '预估片长',
        durationOptions: ['5 分钟以下', '5 - 15 分钟', '15 - 30 分钟', '30 - 60 分钟', '60 分钟以上'],
        speakers: '角色数量',
        speakerOptions: ['1 位', '2 - 3 位', '4 - 6 位', '7 位以上'],
        timeline: '预计时程',
        timelineOptions: ['72 小时内', '1 周内', '2 周内', '弹性安排'],
        budgetRange: '预算区间（USD）',
        budgetRangeOptions: ['3,000 以下', '3,000 - 10,000', '10,000 - 30,000', '30,000 以上'],
        videoLinks: '视频链接（可新增多条）',
        videoLinkPlaceholder: 'https://drive.google.com/... 或 https://youtube.com/...',
        addVideoLink: '新增链接',
        removeLink: '移除',
        notes: '补充说明',
        contentTypeOptions: ['影集 / 剧集', '短剧', '教学 / 课程', '企业 / 品牌影片', '广告', '其他'],
        otherOption: '其他',
        yes: '是',
        no: '否',
        submit: '提交需求',
        submitting: '提交中...',
        submitted: '已收到你的需求',
        submittedDesc: '我们会依据需求内容回复可行方案与时程建议。',
        inquiryNo: '参考编号',
        successToast: '需求已提交',
        failToast: '提交失败，请稍后再试',
        requiredToast: '请先填写姓名、Email、公司、内容类型，并至少提供一个视频链接',
      };
    }

    return {
      studioBadge: 'DUBBING STUDIO',
      title: 'Global AI Original-Voice Dubbing',
      heroSlogan: 'AI handles efficiency we handle quality',
      subtitle: 'Multilingual translation, original-voice preservation, and lip-sync in one workflow.',
      qualityLine: 'Human directors refine translation, tone, pacing, and articulation before delivery.',
      capabilityTitle: 'What We Deliver',
      capabilityItems: [
        'Multilingual translation and localization',
        "Original actor's voice identity preservation",
        'Accurate multilingual lip-sync',
        'Multi-speaker voice segmentation',
        'Noise/artifact cleanup',
        'Final remix and delivery package',
      ],
      workflowTitle: 'Delivery Workflow',
      workflowItems: [
        'Intake and feasibility check',
        'AI multilingual first pass with lip-sync',
        'Human director refinement',
        'Audio cleanup, merge, and final delivery',
      ],
      trustTitle: 'Asset Safety',
      trustBody:
        'Your videos and source files are used only for this project and internal processing. We do not publicly disclose, resell, or use your assets for unauthorized purposes.',
      faqTitle: 'FAQ',
      faqItems: [
        {
          q: 'What is included in this service?',
          a: 'Multilingual translation, original-voice preservation, lip-sync, cleanup, and final merged delivery.',
        },
        {
          q: 'Can you keep the original actor voice identity?',
          a: 'Yes. We preserve voice identity characteristics as much as possible across target languages.',
        },
        {
          q: 'Can you handle multi-speaker series content?',
          a: 'Yes. We support multi-speaker segmentation and role-level processing.',
        },
        {
          q: 'How do you control quality?',
          a: 'AI builds the first pass, then human directors refine translation, tone, pacing, and articulation.',
        },
        {
          q: 'Will our source videos leak?',
          a: 'No. Assets are used only for your project and internal processing.',
        },
      ],
      formTitle: 'Guided Intake Form',
      formSubtitle: 'Mostly dropdowns and checkboxes to reduce back-and-forth.',
      openForm: 'Start Guided Intake',
      requiredHint: 'Fill the required fields first, then add optional project details.',
      requiredSection: 'Required Information',
      optionalSection: 'Optional Project Details',
      selectPlaceholder: 'Select',
      name: 'Contact Name',
      email: 'Email',
      company: 'Company / Brand',
      contentType: 'Content Type',
      sourceLanguage: 'Source Language',
      targetLanguages: 'Target Languages (multi-select)',
      targetLanguagesSelect: 'Select target language',
      addLanguage: 'Add language',
      selectedLanguages: 'Selected languages',
      targetLanguageOptions: [
        'English',
        'Traditional Chinese',
        'Simplified Chinese',
        'Japanese',
        'Korean',
        'Spanish',
        'French',
        'German',
        'Portuguese',
        'Italian',
        'Russian',
        'Turkish',
        'Arabic',
        'Hindi',
        'Urdu',
        'Bengali',
        'Thai',
        'Vietnamese',
        'Indonesian',
        'Malay',
        'Polish',
        'Dutch',
        'Swedish',
        'Danish',
        'Norwegian',
      ],
      needLipSync: 'Need Lip-sync',
      keepOriginalVoice: 'Keep Original Voice',
      duration: 'Estimated Duration',
      durationOptions: ['< 5 min', '5 - 15 min', '15 - 30 min', '30 - 60 min', '60+ min'],
      speakers: 'Speaker Count',
      speakerOptions: ['1', '2 - 3', '4 - 6', '7+'],
      timeline: 'Timeline',
      timelineOptions: ['Within 72 hours', 'Within 1 week', 'Within 2 weeks', 'Flexible'],
      budgetRange: 'Budget Range (USD)',
      budgetRangeOptions: ['Below 3,000', '3,000 - 10,000', '10,000 - 30,000', '30,000+'],
      videoLinks: 'Video Links (add multiple)',
      videoLinkPlaceholder: 'https://drive.google.com/... or https://youtube.com/...',
      addVideoLink: 'Add link',
      removeLink: 'Remove',
      notes: 'Additional Notes',
      contentTypeOptions: ['Drama / Series', 'Short-form Series', 'Education / Tutorial', 'Corporate / Brand Video', 'Advertising', 'Other'],
      otherOption: 'Other',
      yes: 'Yes',
      no: 'No',
      submit: 'Submit Inquiry',
      submitting: 'Submitting...',
      submitted: 'Inquiry Received',
      submittedDesc: 'We will reply with a suggested production path and timeline.',
      inquiryNo: 'Reference Number',
      successToast: 'Inquiry submitted',
      failToast: 'Submission failed, please try again',
      requiredToast: 'Please complete name, email, company, content type, and at least one video link',
    };
  }, [isZhTW, isZhCN]);

  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    company: '',
    contentType: '',
    sourceLanguage: '',
    targetLanguages: [],
    needLipSync: 'yes',
    keepOriginalVoice: 'yes',
    duration: '',
    speakers: '',
    timeline: '',
    budgetRange: '',
    videoLinks: [''],
    notes: '',
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [inquiryNumber, setInquiryNumber] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [targetLanguageSelection, setTargetLanguageSelection] = useState('');
  const capabilityIcons = [Languages, Mic2, AudioWaveform, Clapperboard, ShieldCheck, CheckCircle2];
  const capabilityCardClasses = [
    'border-cyan-400/20 bg-cyan-500/[0.06]',
    'border-violet-400/20 bg-violet-500/[0.06]',
    'border-emerald-400/20 bg-emerald-500/[0.06]',
    'border-blue-400/20 bg-blue-500/[0.06]',
    'border-fuchsia-400/20 bg-fuchsia-500/[0.06]',
    'border-teal-400/20 bg-teal-500/[0.06]',
  ];
  const capabilityIconClasses = [
    'text-cyan-300',
    'text-violet-300',
    'text-emerald-300',
    'text-blue-300',
    'text-fuchsia-300',
    'text-teal-300',
  ];
  const inputClass =
    'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-white/30';
  const serviceJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: 'Multilingual AI Dubbing',
    name: 'Onyx Global AI Dubbing',
    provider: {
      '@type': 'Organization',
      name: 'Onyx Studios',
      url: 'https://www.onyxstudios.ai',
    },
    areaServed: 'Worldwide',
    inLanguage: locale,
  };
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: copy.faqItems.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addTargetLanguage = () => {
    if (!targetLanguageSelection) return;
    if (form.targetLanguages.includes(targetLanguageSelection)) return;
    setField('targetLanguages', [...form.targetLanguages, targetLanguageSelection]);
    setTargetLanguageSelection('');
  };

  const removeTargetLanguage = (lang: string) => {
    setField('targetLanguages', form.targetLanguages.filter((v) => v !== lang));
  };

  const updateVideoLink = (index: number, value: string) => {
    const next = [...form.videoLinks];
    next[index] = value;
    setField('videoLinks', next);
  };

  const addVideoLink = () => {
    setField('videoLinks', [...form.videoLinks, '']);
  };

  const removeVideoLink = (index: number) => {
    if (form.videoLinks.length === 1) {
      setField('videoLinks', ['']);
      return;
    }
    setField(
      'videoLinks',
      form.videoLinks.filter((_, idx) => idx !== index),
    );
  };

  const buildMessage = () => {
    const lines = [
      '[Global Dubbing Intake]',
      `Company: ${form.company || '-'}`,
      `Content Type: ${form.contentType || '-'}`,
      `Source Language: ${form.sourceLanguage || '-'}`,
      `Target Languages: ${form.targetLanguages.join(', ') || '-'}`,
      `Need Lip-sync: ${form.needLipSync}`,
      `Keep Original Voice: ${form.keepOriginalVoice}`,
      `Duration: ${form.duration || '-'}`,
      `Speaker Count: ${form.speakers || '-'}`,
      `Timeline: ${form.timeline || '-'}`,
      `Budget Range: ${form.budgetRange || '-'}`,
      `Video Links: ${form.videoLinks.filter((v) => v.trim()).join(', ') || '-'}`,
      '',
      '[Notes]',
      form.notes || '-',
    ];
    return lines.join('\n');
  };

  const submit = async () => {
    if (
      !form.name ||
      !form.email ||
      !form.company ||
      !form.contentType ||
      form.videoLinks.filter((v) => v.trim()).length === 0
    ) {
      toast.error(copy.requiredToast);
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/contact/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          message: buildMessage(),
          department: 'PRODUCTION',
          source: 'global-dubbing-page',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'failed');
      setInquiryNumber(data.inquiryNumber || '');
      setSent(true);
      toast.success(copy.successToast);
    } catch {
      toast.error(copy.failToast);
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white overflow-x-hidden pt-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <section className="relative min-h-[calc(100vh-6rem)] flex items-center px-4 sm:px-6 lg:px-8 pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(139,92,246,0.22),transparent_58%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_72%,rgba(20,184,166,0.12),transparent_48%)] pointer-events-none" />
        <div className="relative max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-500/[0.08] px-5 py-2 mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-300" />
            <span className="text-sm tracking-wide text-gray-100 font-medium">{copy.studioBadge}</span>
          </div>

          <p className="text-sm md:text-base text-gray-400 mb-4">{copy.title}</p>
          <h1
            className={`font-bold leading-[1.08] tracking-tight bg-gradient-to-r from-white via-emerald-100 to-cyan-200 bg-clip-text text-transparent mx-auto ${
              isEnglish
                ? 'text-4xl md:text-5xl lg:text-6xl max-w-6xl'
                : 'text-4xl md:text-6xl lg:text-[5rem] max-w-5xl md:whitespace-nowrap'
            }`}
          >
            {copy.heroSlogan}
          </h1>
          <p className="text-lg md:text-2xl text-gray-300 mt-6 max-w-4xl mx-auto leading-relaxed">{copy.subtitle}</p>
          <p className="text-sm md:text-base text-gray-400 mt-2 max-w-3xl mx-auto leading-relaxed">{copy.qualityLine}</p>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
            {copy.capabilityItems.map((item, idx) => (
              <div
                key={item}
                className={`rounded-2xl border px-5 py-4 text-left backdrop-blur-sm ${capabilityCardClasses[idx]}`}
              >
                <div className="flex items-start gap-3">
                  {(() => {
                    const Icon = capabilityIcons[idx];
                    return <Icon className={`w-5 h-5 mt-0.5 ${capabilityIconClasses[idx]}`} />;
                  })()}
                  <p className="text-gray-100 leading-relaxed">{item}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 pb-10">
        <div className="max-w-6xl mx-auto rounded-2xl border border-violet-400/20 bg-violet-500/[0.05] p-6 md:p-8">
          <div className="flex items-center gap-2 mb-4">
            <Clapperboard className="w-5 h-5 text-violet-300" />
            <h2 className="text-2xl font-bold">{copy.workflowTitle}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {copy.workflowItems.map((step) => (
              <div key={step} className="rounded-lg border border-violet-300/15 bg-black/35 px-4 py-3 text-gray-200">
                {step}
              </div>
            ))}
          </div>
          <div className="mt-7 text-center">
            <button
              onClick={() => setIsFormOpen(true)}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 shadow-[0_0_30px_rgba(168,85,247,0.35)] transition-colors font-semibold text-lg"
            >
              {copy.openForm}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 pb-10">
        <div className="max-w-6xl mx-auto rounded-2xl border border-teal-400/30 bg-teal-500/[0.10] p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-teal-200 mt-0.5" />
            <div>
              <h3 className="font-semibold text-teal-100 mb-1">{copy.trustTitle}</h3>
              <p className="text-teal-50/90 text-sm leading-relaxed">{copy.trustBody}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 pb-20">
        <div className="max-w-6xl mx-auto rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8 mb-8">
          <h2 className="text-2xl font-bold mb-4">{copy.faqTitle}</h2>
          <Accordion type="single" collapsible className="w-full">
            {copy.faqItems.map((item, idx) => (
              <AccordionItem key={item.q} value={`faq-${idx}`} className="border-white/10">
                <AccordionTrigger className="text-left text-white hover:no-underline">{item.q}</AccordionTrigger>
                <AccordionContent className="text-gray-300">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div className="max-w-6xl mx-auto rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
          <h2 className="text-2xl font-bold mb-1">{copy.formTitle}</h2>
          <p className="text-gray-400 text-sm mb-5">{copy.formSubtitle}</p>
          <p className="text-gray-500 text-sm mb-6">{copy.requiredHint}</p>
          <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
            <SheetTrigger asChild>
              <button className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 transition-colors font-semibold">
                {copy.openForm}
                <ArrowRight className="w-4 h-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-[#0a0a0a] border-white/10 text-white w-full sm:max-w-2xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="text-white">{copy.formTitle}</SheetTitle>
                <SheetDescription>{copy.requiredHint}</SheetDescription>
              </SheetHeader>

              <div className="mt-6">
                {sent ? (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-300 mx-auto mb-3" />
                    <p className="text-lg font-semibold text-emerald-100">{copy.submitted}</p>
                    <p className="text-sm text-emerald-100/80 mt-1">{copy.submittedDesc}</p>
                    {inquiryNumber && (
                      <p className="mt-4 text-sm text-emerald-200">
                        {copy.inquiryNo}: <span className="font-mono font-bold">{inquiryNumber}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <p className="text-sm font-semibold text-white mb-3">{copy.requiredSection}</p>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Field label={copy.name} required>
                            <input className={inputClass} value={form.name} onChange={(e) => setField('name', e.target.value)} />
                          </Field>
                          <Field label={copy.email} required>
                            <input className={inputClass} type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} />
                          </Field>
                        </div>
                        <Field label={copy.company} required>
                          <input className={inputClass} value={form.company} onChange={(e) => setField('company', e.target.value)} />
                        </Field>
                        <Field label={copy.contentType} required>
                          <select className={inputClass} value={form.contentType} onChange={(e) => setField('contentType', e.target.value)}>
                            <option value="">{copy.selectPlaceholder}</option>
                            {copy.contentTypeOptions.map((option: string) => (
                              <option key={option}>{option}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label={copy.targetLanguages}>
                          <div className="space-y-3">
                            <div className="flex gap-2">
                              <select
                                className={inputClass}
                                value={targetLanguageSelection}
                                onChange={(e) => setTargetLanguageSelection(e.target.value)}
                              >
                                <option value="">{copy.targetLanguagesSelect}</option>
                                {copy.targetLanguageOptions.map((lang: string) => (
                                  <option key={lang}>{lang}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={addTargetLanguage}
                                className="shrink-0 px-4 py-2 rounded-lg border border-blue-400/40 bg-blue-500/20 text-blue-100 hover:bg-blue-500/30 text-sm"
                              >
                                {copy.addLanguage}
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {form.targetLanguages.length === 0 ? (
                                <span className="text-xs text-gray-500">{copy.selectPlaceholder}</span>
                              ) : (
                                form.targetLanguages.map((lang) => (
                                  <button
                                    key={lang}
                                    type="button"
                                    onClick={() => removeTargetLanguage(lang)}
                                    className="px-3 py-1.5 rounded-full border border-blue-400/40 bg-blue-500/20 text-blue-100 text-xs"
                                  >
                                    {lang} ×
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        </Field>
                        <Field label={copy.videoLinks} required>
                          <div className="space-y-2">
                            {form.videoLinks.map((link, index) => (
                              <div key={`${index}-${link}`} className="flex gap-2">
                                <input
                                  className={inputClass}
                                  placeholder={copy.videoLinkPlaceholder}
                                  value={link}
                                  onChange={(e) => updateVideoLink(index, e.target.value)}
                                />
                                <button
                                  type="button"
                                  onClick={() => removeVideoLink(index)}
                                  className="shrink-0 px-3 py-2 rounded-lg border border-white/15 text-gray-300 hover:text-white hover:border-white/30 text-sm"
                                >
                                  {copy.removeLink}
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={addVideoLink}
                              className="px-4 py-2 rounded-lg border border-emerald-400/40 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30 text-sm"
                            >
                              {copy.addVideoLink}
                            </button>
                          </div>
                        </Field>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-white mb-3">{copy.optionalSection}</p>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Field label={copy.sourceLanguage}>
                            <select className={inputClass} value={form.sourceLanguage} onChange={(e) => setField('sourceLanguage', e.target.value)}>
                              <option value="">{copy.selectPlaceholder}</option>
                              {copy.targetLanguageOptions.map((lang: string) => (
                                <option key={lang}>{lang}</option>
                              ))}
                              <option>{copy.otherOption}</option>
                            </select>
                          </Field>
                          <Field label={copy.duration}>
                            <select className={inputClass} value={form.duration} onChange={(e) => setField('duration', e.target.value)}>
                              <option value="">{copy.selectPlaceholder}</option>
                              {copy.durationOptions.map((option: string) => (
                                <option key={option}>{option}</option>
                              ))}
                            </select>
                          </Field>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Field label={copy.needLipSync}>
                            <SelectPair value={form.needLipSync} onChange={(v) => setField('needLipSync', v)} yesLabel={copy.yes} noLabel={copy.no} />
                          </Field>
                          <Field label={copy.keepOriginalVoice}>
                            <SelectPair value={form.keepOriginalVoice} onChange={(v) => setField('keepOriginalVoice', v)} yesLabel={copy.yes} noLabel={copy.no} />
                          </Field>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Field label={copy.speakers}>
                            <select className={inputClass} value={form.speakers} onChange={(e) => setField('speakers', e.target.value)}>
                              <option value="">{copy.selectPlaceholder}</option>
                              {copy.speakerOptions.map((option: string) => (
                                <option key={option}>{option}</option>
                              ))}
                            </select>
                          </Field>
                          <Field label={copy.timeline}>
                            <select className={inputClass} value={form.timeline} onChange={(e) => setField('timeline', e.target.value)}>
                              <option value="">{copy.selectPlaceholder}</option>
                              {copy.timelineOptions.map((option: string) => (
                                <option key={option}>{option}</option>
                              ))}
                            </select>
                          </Field>
                          <Field label={copy.budgetRange}>
                            <select className={inputClass} value={form.budgetRange} onChange={(e) => setField('budgetRange', e.target.value)}>
                              <option value="">{copy.selectPlaceholder}</option>
                              {copy.budgetRangeOptions.map((option: string) => (
                                <option key={option}>{option}</option>
                              ))}
                            </select>
                          </Field>
                        </div>
                        <Field label={copy.notes}>
                          <textarea
                            className={`${inputClass} min-h-[120px]`}
                            value={form.notes}
                            onChange={(e) => setField('notes', e.target.value)}
                          />
                        </Field>
                      </div>
                    </div>

                    <button
                      onClick={submit}
                      disabled={sending}
                      className="w-full px-8 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold inline-flex items-center justify-center"
                    >
                      {sending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          {copy.submitting}
                        </>
                      ) : (
                        copy.submit
                      )}
                    </button>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function Field({ label, children, required = false }: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="block text-sm text-gray-300 mb-2">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}

function SelectPair({
  value,
  onChange,
  yesLabel,
  noLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  yesLabel: string;
  noLabel: string;
}) {
  const options = [
    { id: 'yes', label: yesLabel },
    { id: 'no', label: noLabel },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`px-3 py-2 rounded-lg border text-sm transition ${
            value === option.id ? 'bg-blue-500/20 border-blue-400 text-blue-100' : 'bg-black/30 border-white/10 text-gray-300'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
