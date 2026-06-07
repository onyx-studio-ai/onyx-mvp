'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Mail, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

type Locale = 'en' | 'zh-TW' | 'zh-CN';
type Department = 'HELLO' | 'PRODUCTION' | 'SUPPORT' | 'BILLING' | 'ADMIN';

interface ContactInquiryFormProps {
  locale: Locale;
}

const COPY: Record<Locale, {
  sectionTitle: string;
  sectionDesc: string;
  nameLabel: string;
  namePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  topicLabel: string;
  topicGeneral: string;
  topicDubbing: string;
  topicMusic: string;
  topicVoice: string;
  topicData: string;
  topicTechnical: string;
  topicBilling: string;
  messageLabel: string;
  messagePlaceholderGeneral: string;
  messagePlaceholderDubbing: string;
  messagePlaceholderMusic: string;
  messagePlaceholderVoice: string;
  messagePlaceholderData: string;
  errorRequired: string;
  errorEmail: string;
  sending: string;
  sendButton: string;
  successTitle: string;
  successDesc: string;
  successReference: string;
  successFootnote: string;
  successClose: string;
}> = {
  en: {
    sectionTitle: 'Send a project brief',
    sectionDesc: 'Tell us about your project. We typically respond within one business day.',
    nameLabel: 'Name',
    namePlaceholder: 'Your name',
    emailLabel: 'Email',
    emailPlaceholder: 'you@company.com',
    topicLabel: 'Topic',
    topicGeneral: 'General enquiry',
    topicDubbing: 'Video dubbing project',
    topicMusic: 'Music production project',
    topicVoice: 'Voice production project',
    topicData: 'Voice data collection (AI training)',
    topicTechnical: 'Technical / account support',
    topicBilling: 'Billing',
    messageLabel: 'Project details',
    messagePlaceholderGeneral: 'How can we help?',
    messagePlaceholderDubbing: 'Source language, target language(s), total duration in minutes, deadline, any reference material.',
    messagePlaceholderMusic: 'Project type (ad, film, brand), desired vibe / references, target length, deadline.',
    messagePlaceholderVoice: 'Language, character/tone, script length, deadline, usage (broadcast, web, internal).',
    messagePlaceholderData: 'Target language(s), required finished hours, voice type (TTS / clone / chat), license scope, deadline.',
    errorRequired: 'Please fill in name, email, and project details.',
    errorEmail: 'Please enter a valid email address.',
    sending: 'Sending…',
    sendButton: 'Send brief',
    successTitle: 'Brief received',
    successDesc: 'Thanks — we have your brief and an email confirmation is on its way.',
    successReference: 'Reference',
    successFootnote: 'We typically respond within one business day.',
    successClose: 'Send another',
  },
  'zh-TW': {
    sectionTitle: '送出專案需求',
    sectionDesc: '告訴我們你的專案，我們通常一個工作日內回覆。',
    nameLabel: '姓名',
    namePlaceholder: '你的名字',
    emailLabel: '電子郵件',
    emailPlaceholder: 'you@company.com',
    topicLabel: '主題',
    topicGeneral: '一般諮詢',
    topicDubbing: '影片配音專案',
    topicMusic: '音樂製作專案',
    topicVoice: '配音製作專案',
    topicData: '語音資料採集 (AI 訓練用)',
    topicTechnical: '技術支援 / 帳號',
    topicBilling: '帳務',
    messageLabel: '專案內容',
    messagePlaceholderGeneral: '需要什麼協助？',
    messagePlaceholderDubbing: '原語、目標語系、總時長（分鐘）、交付期限、有無參考素材。',
    messagePlaceholderMusic: '專案類型（廣告／影片／品牌）、想要的曲風或參考、預估長度、交付期限。',
    messagePlaceholderVoice: '語系、角色／語氣、腳本長度、交付期限、用途（廣播／網路／內部）。',
    messagePlaceholderData: '目標語系、需要完成時數、聲線類型 (TTS / 克隆 / 對話)、授權範圍、交付期限。',
    errorRequired: '請填寫姓名、Email 與專案內容。',
    errorEmail: '請輸入有效的 Email。',
    sending: '送出中…',
    sendButton: '送出需求',
    successTitle: '需求已收到',
    successDesc: '我們已收到你的需求，確認信也已寄出。',
    successReference: '案件編號',
    successFootnote: '我們通常一個工作日內回覆。',
    successClose: '再送一筆',
  },
  'zh-CN': {
    sectionTitle: '送出项目需求',
    sectionDesc: '告诉我们你的项目，我们通常一个工作日内回复。',
    nameLabel: '姓名',
    namePlaceholder: '你的名字',
    emailLabel: '电子邮件',
    emailPlaceholder: 'you@company.com',
    topicLabel: '主题',
    topicGeneral: '一般咨询',
    topicDubbing: '影视配音项目',
    topicMusic: '音乐制作项目',
    topicVoice: '配音制作项目',
    topicData: '语音数据采集 (AI 训练用)',
    topicTechnical: '技术支持 / 账号',
    topicBilling: '账务',
    messageLabel: '项目内容',
    messagePlaceholderGeneral: '需要什么协助？',
    messagePlaceholderDubbing: '原语、目标语种、总时长（分钟）、交付期限、有无参考素材。',
    messagePlaceholderMusic: '项目类型（广告／影片／品牌）、想要的曲风或参考、预估长度、交付期限。',
    messagePlaceholderVoice: '语种、角色／语气、脚本长度、交付期限、用途（广播／网络／内部）。',
    messagePlaceholderData: '目标语种、需要完成时数、声线类型 (TTS / 克隆 / 对话)、授权范围、交付期限。',
    errorRequired: '请填写姓名、Email 与项目内容。',
    errorEmail: '请输入有效的 Email。',
    sending: '送出中…',
    sendButton: '送出需求',
    successTitle: '需求已收到',
    successDesc: '我们已收到你的需求，确认信也已寄出。',
    successReference: '案件编号',
    successFootnote: '我们通常一个工作日内回复。',
    successClose: '再送一笔',
  },
};

// Maps the ?source= query value to a default topic key.
const SOURCE_TO_TOPIC: Record<string, 'general' | 'dubbing' | 'music' | 'voice' | 'data'> = {
  'dubbing-project': 'dubbing',
  'music-project':   'music',
  'voice-project':   'voice',
  'data-project':    'data',
};

// Each topic maps to (department for routing, message-placeholder key).
const TOPICS: { key: 'general' | 'dubbing' | 'music' | 'voice' | 'data' | 'technical' | 'billing'; department: Department }[] = [
  { key: 'general',   department: 'HELLO' },
  { key: 'dubbing',   department: 'PRODUCTION' },
  { key: 'music',     department: 'PRODUCTION' },
  { key: 'voice',     department: 'PRODUCTION' },
  { key: 'data',      department: 'PRODUCTION' },
  { key: 'technical', department: 'SUPPORT' },
  { key: 'billing',   department: 'BILLING' },
];

export default function ContactInquiryForm({ locale }: ContactInquiryFormProps) {
  const t = COPY[locale];
  const searchParams = useSearchParams();
  const sourceParam = searchParams.get('source') || 'contact-page';

  const initialTopic = SOURCE_TO_TOPIC[sourceParam] || 'general';
  const [topic, setTopic] = useState<typeof TOPICS[number]['key']>(initialTopic);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [inquiryNumber, setInquiryNumber] = useState('');

  // If the URL ?source= changes (e.g. shallow nav), update the topic.
  useEffect(() => {
    const next = SOURCE_TO_TOPIC[sourceParam];
    if (next) setTopic(next);
  }, [sourceParam]);

  const topicLabel = (key: typeof topic): string => {
    switch (key) {
      case 'general':   return t.topicGeneral;
      case 'dubbing':   return t.topicDubbing;
      case 'music':     return t.topicMusic;
      case 'voice':     return t.topicVoice;
      case 'data':      return t.topicData;
      case 'technical': return t.topicTechnical;
      case 'billing':   return t.topicBilling;
    }
  };

  const messagePlaceholder = (() => {
    switch (topic) {
      case 'dubbing': return t.messagePlaceholderDubbing;
      case 'music':   return t.messagePlaceholderMusic;
      case 'voice':   return t.messagePlaceholderVoice;
      case 'data':    return t.messagePlaceholderData;
      default:        return t.messagePlaceholderGeneral;
    }
  })();

  const departmentForTopic =
    TOPICS.find(x => x.key === topic)?.department ?? 'HELLO';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error(t.errorRequired);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error(t.errorEmail);
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/contact/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          department: departmentForTopic,
          source: sourceParam,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'send failed');
      setInquiryNumber(data.inquiryNumber || '');
      setSent(true);
    } catch (err) {
      console.error('[ContactInquiryForm] send error:', err);
      toast.error('Failed to send. Please try again or email us directly.');
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setMessage('');
    setInquiryNumber('');
    setSent(false);
  };

  if (sent) {
    return (
      <div className="mt-20 max-w-3xl mx-auto rounded-3xl p-12 bg-gradient-to-br from-emerald-950/30 to-cyan-950/30 border border-emerald-500/20 text-center">
        <CheckCircle className="w-14 h-14 text-emerald-400 mx-auto mb-5" aria-hidden="true" />
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">{t.successTitle}</h2>
        <p className="text-gray-300 mb-6 leading-relaxed">{t.successDesc}</p>
        {inquiryNumber && (
          <div className="inline-block bg-white/5 border border-white/10 rounded-xl px-5 py-3 mb-6">
            <div className="text-xs text-gray-500 mb-1 tracking-wider uppercase">{t.successReference}</div>
            <div className="text-emerald-400 text-lg font-mono font-bold tracking-wider">{inquiryNumber}</div>
          </div>
        )}
        <p className="text-gray-500 text-sm mb-8">{t.successFootnote}</p>
        <button
          type="button"
          onClick={resetForm}
          className="inline-flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/15 text-white px-6 py-3 font-medium transition-colors"
        >
          {t.successClose}
        </button>
      </div>
    );
  }

  const inputClass =
    'w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/60 focus:bg-white/[0.06] transition-colors disabled:opacity-50';

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-20 max-w-3xl mx-auto rounded-3xl p-8 md:p-12 bg-gradient-to-br from-blue-950/30 to-cyan-950/30 border border-blue-500/20"
    >
      <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">{t.sectionTitle}</h2>
      <p className="text-gray-300 mb-8 leading-relaxed">{t.sectionDesc}</p>

      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="contact-name" className="block text-sm font-medium text-gray-300 mb-2">
              {t.nameLabel}
            </label>
            <input
              id="contact-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.namePlaceholder}
              disabled={sending}
              className={inputClass}
              autoComplete="name"
            />
          </div>
          <div>
            <label htmlFor="contact-email" className="block text-sm font-medium text-gray-300 mb-2">
              {t.emailLabel}
            </label>
            <input
              id="contact-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              disabled={sending}
              className={inputClass}
              autoComplete="email"
            />
          </div>
        </div>

        <div>
          <label htmlFor="contact-topic" className="block text-sm font-medium text-gray-300 mb-2">
            {t.topicLabel}
          </label>
          <select
            id="contact-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value as typeof topic)}
            disabled={sending}
            className={inputClass}
          >
            {TOPICS.map(({ key }) => (
              <option key={key} value={key} className="bg-[#0a0a0a]">
                {topicLabel(key)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="contact-message" className="block text-sm font-medium text-gray-300 mb-2">
            {t.messageLabel}
          </label>
          <textarea
            id="contact-message"
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={messagePlaceholder}
            disabled={sending}
            rows={6}
            className={`${inputClass} resize-y min-h-[140px] leading-relaxed`}
          />
        </div>

        <button
          type="submit"
          disabled={sending}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-4 px-6 text-base font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {sending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
              {t.sending}
            </>
          ) : (
            <>
              <Mail className="w-5 h-5" aria-hidden="true" />
              {t.sendButton}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
