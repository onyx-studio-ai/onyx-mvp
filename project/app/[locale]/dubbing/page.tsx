import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Footer from '@/components/landing/Footer';

type Locale = 'en' | 'zh-TW' | 'zh-CN';

const COPY: Record<Locale, {
  badge: string;
  title: string;
  subtitle: string;
  lead: string;
  langTitle: string;
  langDesc: string;
  qualityTitle: string;
  qualityDesc: string;
  scaleTitle: string;
  scaleDesc: string;
  ctaTitle: string;
  ctaDesc: string;
  ctaButton: string;
}> = {
  en: {
    badge: 'DUBBING STUDIO',
    title: 'Multilingual Dubbing for Film, Game, and Brand Content',
    subtitle: 'AI speed, human-directed quality. From source script to broadcast-ready audio in 30+ languages.',
    lead: 'For films, ads, e-learning, and bulk localisation projects where pure-AI output isn\'t enough but full studio rates aren\'t justified. We sit between the two — AI does the heavy lifting, our voice directors catch the things AI misses.',
    langTitle: '30+ languages',
    langDesc: 'Major European, East Asian, South Asian, and Arabic dialects. Specialist talent for Hindi, MSA, Najdi, Brazilian Portuguese, Cantonese.',
    qualityTitle: 'Human review on every minute',
    qualityDesc: 'Voice directors verify pronunciation, emotion, pacing, and cultural fit. You don\'t get raw AI output — you get reviewed delivery files.',
    scaleTitle: 'Built for volume',
    scaleDesc: '2,000+ minute jobs welcome. We have the talent roster and director bandwidth to deliver in 7–14 days with quality control intact.',
    ctaTitle: 'Send your project brief',
    ctaDesc: 'Tell us source language, target language(s), duration, and timeline. We reply within 24 hours with scoped quote.',
    ctaButton: 'Submit dubbing brief',
  },
  'zh-TW': {
    badge: '影片配音工作室',
    title: '影片、遊戲、品牌內容的多語配音',
    subtitle: 'AI 速度、真人導演品質。從原始腳本到可直接上線的音檔，30+ 語系。',
    lead: '為電影、廣告、e-learning、大量在地化專案而設。純 AI 不夠用、但全包真人錄音室太貴的甜蜜點 — AI 處理重活，聲音導演把關 AI 漏掉的細節。',
    langTitle: '30+ 語系',
    langDesc: '主要歐語、東亞、南亞、阿拉伯方言。印度語、現代標準阿語、納吉迪沙語、巴西葡語、粵語都有專人。',
    qualityTitle: '每分鐘都過真人',
    qualityDesc: '聲音導演檢查發音、情緒、節奏、文化適配。客戶拿到的不是純 AI 輸出 — 是經過審聽的交付檔。',
    scaleTitle: '為量身打造',
    scaleDesc: '2,000+ 分鐘專案歡迎。配音員 roster 與導演產能足以在 7–14 天交付，品質不打折。',
    ctaTitle: '送出專案需求',
    ctaDesc: '告訴我們原語、目標語系、時長、時程，24 小時內回覆報價。',
    ctaButton: '提交配音需求',
  },
  'zh-CN': {
    badge: '影视配音工作室',
    title: '影视、游戏、品牌内容的多语配音',
    subtitle: 'AI 速度、真人导演品质。从原始脚本到可直接上线的音档，30+ 语种。',
    lead: '为电影、广告、e-learning、大量本地化项目而设。纯 AI 不够用、但全包真人录音棚太贵的甜蜜点 — AI 处理重活，声音导演把关 AI 漏掉的细节。',
    langTitle: '30+ 语种',
    langDesc: '主要欧语、东亚、南亚、阿拉伯方言。印度语、现代标准阿语、纳吉迪沙语、巴西葡语、粤语都有专人。',
    qualityTitle: '每分钟都过真人',
    qualityDesc: '声音导演检查发音、情绪、节奏、文化适配。客户拿到的不是纯 AI 输出 — 是经过审听的交付档。',
    scaleTitle: '为大量量身打造',
    scaleDesc: '2,000+ 分钟项目欢迎。配音员 roster 与导演产能足以在 7–14 天交付，品质不打折。',
    ctaTitle: '送出项目需求',
    ctaDesc: '告诉我们原语、目标语种、时长、时程，24 小时内回复报价。',
    ctaButton: '提交配音需求',
  },
};

export default async function DubbingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale: Locale = rawLocale in COPY ? (rawLocale as Locale) : 'en';
  const t = COPY[locale];
  const contactPath = locale === 'en' ? '/contact?source=dubbing-project' : `/${locale}/contact?source=dubbing-project`;

  return (
    <main className="min-h-screen bg-[#050505] text-white overflow-x-hidden pt-28">
      <section className="relative px-4 sm:px-6 lg:px-8 pb-16">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative max-w-5xl mx-auto">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-blue-300/25 bg-blue-500/[0.08] px-5 py-2">
            <span className="w-2 h-2 rounded-full bg-blue-300" />
            <span className="text-sm tracking-wide text-gray-100 font-medium">{t.badge}</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-[1.1] tracking-tight">
            <span className="block bg-gradient-to-r from-blue-200 via-cyan-200 to-teal-200 bg-clip-text text-transparent">
              {t.title}
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl leading-relaxed">
            {t.subtitle}
          </p>
          <p className="text-base md:text-lg text-gray-400 max-w-3xl leading-relaxed">
            {t.lead}
          </p>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { num: '01', title: t.langTitle, desc: t.langDesc },
            { num: '02', title: t.qualityTitle, desc: t.qualityDesc },
            { num: '03', title: t.scaleTitle, desc: t.scaleDesc },
          ].map(({ num, title, desc }) => (
            <div key={title} className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-7 md:p-8">
              <div className="font-mono text-xs tracking-[0.25em] text-blue-300/70 mb-5">{num}</div>
              <h2 className="text-lg md:text-xl font-bold text-white mb-2 tracking-tight">{title}</h2>
              <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-3xl mx-auto rounded-2xl bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent border border-blue-400/20 p-10 md:p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">{t.ctaTitle}</h2>
          <p className="text-gray-300 mb-8 leading-relaxed">{t.ctaDesc}</p>
          <Link
            href={contactPath}
            className="inline-flex items-center gap-2 rounded-full bg-white text-black px-8 py-4 font-semibold hover:bg-gray-100 transition-colors"
          >
            {t.ctaButton}
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
