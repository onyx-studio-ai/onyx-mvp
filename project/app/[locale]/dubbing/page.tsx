'use client';

/**
 * /dubbing — landing page for Onyx's multilingual dubbing service.
 *
 * Visual structure mirrors /music/orchestra (hero → why-block → languages
 * → workflow → capabilities → transparency → CTA) so the brand voice is
 * consistent across "bespoke project" services. The previous 3-card
 * minimal layout didn't match other pages and read thin given dubbing
 * is a major Onyx service line.
 *
 * Copy uses the inline `tx(tw, cn, en)` helper used by the other music
 * pages so future edits stay in one place rather than round-tripping to
 * messages.json — easier for Wing to iterate on phrasing.
 *
 * CTA routes to /dubbing/brief (dedicated dubbing intake form) instead
 * of /contact, matching the inquiry-first pattern used by /music/brief
 * for bespoke services.
 */

import { motion } from 'framer-motion';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  ArrowRight, Mic, Globe, Layers,
  Upload, FileCheck, Headphones, Package,
} from 'lucide-react';
import Footer from '@/components/landing/Footer';

export default function DubbingPage() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  const languageRegions = [
    {
      title: tx('歐美主要語', '欧美主要语', 'Western languages'),
      list: tx(
        '英文（美 / 英）、西班牙文、法文、德文、葡萄牙文、義大利文、俄文、波蘭文、荷蘭文',
        '英文（美 / 英）、西班牙文、法文、德文、葡萄牙文、意大利文、俄文、波兰文、荷兰文',
        'English (US / UK), Spanish, French, German, Portuguese, Italian, Russian, Polish, Dutch'
      ),
    },
    {
      title: tx('東亞', '东亚', 'East Asian'),
      list: tx(
        '中文（繁體 / 簡體 / 粵語）、日文、韓文',
        '中文（繁体 / 简体 / 粤语）、日文、韩文',
        'Chinese (Traditional / Simplified / Cantonese), Japanese, Korean'
      ),
    },
    {
      title: tx('南亞', '南亚', 'South Asian'),
      list: tx(
        '印地語、孟加拉語、淡米爾語、烏爾都語',
        '印地语、孟加拉语、泰米尔语、乌尔都语',
        'Hindi, Bengali, Tamil, Urdu'
      ),
    },
    {
      title: tx('阿拉伯', '阿拉伯', 'Arabic dialects'),
      list: tx(
        '現代標準阿拉伯語（MSA）、納吉迪、埃及、海灣、黎凡特',
        '现代标准阿拉伯语（MSA）、纳吉迪、埃及、海湾、黎凡特',
        'Modern Standard Arabic (MSA), Najdi, Egyptian, Gulf, Levantine'
      ),
    },
  ];

  // Workflow shown at a higher abstraction than the internal SOP — industry
  // insiders know what's in each step, outsiders will ask. Keeping it tight
  // protects what's effectively trade craft.
  const workflow = [
    {
      num: '01', icon: Upload,
      title: tx('詢價', '询价', 'Inquire'),
      desc: tx(
        'Brief 接洽，24 小時內回覆方向與報價。',
        'Brief 接洽，24 小时内回复方向与报价。',
        'Brief received. Direction + quote within 24h.'
      ),
    },
    {
      num: '02', icon: FileCheck,
      title: tx('翻譯', '翻译', 'Translate'),
      desc: tx(
        '專業翻譯 + 在地化校對。',
        '专业翻译 + 在地化校对。',
        'Professional translation + localization review.'
      ),
    },
    {
      num: '03', icon: Headphones,
      title: tx('製作', '制作', 'Produce'),
      desc: tx(
        '錄製 + 後製，品質全程把關。',
        '录制 + 后制，品质全程把关。',
        'Recording + post-production, quality supervised end-to-end.'
      ),
    },
    {
      num: '04', icon: Package,
      title: tx('交付', '交付', 'Deliver'),
      desc: tx(
        '48k / 24-bit WAV 分軌 + master，或客戶指定規格。',
        '48k / 24-bit WAV 分轨 + master，或客户指定规格。',
        '48k / 24-bit WAV stems + master, or any spec you need.'
      ),
    },
  ];

  const capabilities = [
    {
      icon: Mic,
      title: tx('真人導演品質', '真人导演品质', 'Director-led quality'),
      desc: tx(
        '每分鐘都經聲音導演檢查發音、情緒、節奏、文化適配。',
        '每分钟都经声音导演检查发音、情绪、节奏、文化适配。',
        'Every minute passes through the director — pronunciation, emotion, pacing, cultural fit.'
      ),
    },
    {
      icon: Globe,
      title: tx('30+ 語種覆蓋', '30+ 语种覆盖', '30+ languages'),
      desc: tx(
        '從歐美主流到阿拉伯方言、亞語小眾，涵蓋全球主要市場。',
        '从欧美主流到阿拉伯方言、亚语小众，涵盖全球主要市场。',
        'Major Western, East Asian, South Asian, and Arabic dialects covered.'
      ),
    },
    {
      icon: Layers,
      title: tx('為大批量案件打造', '为大批量项目打造', 'Built for volume'),
      desc: tx(
        '2,000+ 分鐘案件接得了，7-14 天交付，品質不打折。',
        '2,000+ 分钟项目接得了，7-14 天交付，品质不打折。',
        '2,000+ minute jobs welcome. 7-14 day delivery without compromising quality.'
      ),
    },
  ];

  return (
    <main className="min-h-screen bg-[#050505] text-white overflow-x-hidden pt-28">

      {/* HERO */}
      <section className="relative px-4 sm:px-6 lg:px-8 pb-12">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 via-transparent to-transparent pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="relative max-w-5xl mx-auto"
        >
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-blue-300/25 bg-blue-500/[0.08] px-5 py-2">
            <span className="w-2 h-2 rounded-full bg-blue-300 animate-pulse" />
            <span className="text-sm tracking-wide text-gray-100 font-medium">
              {tx('影片配音工作室', '影视配音工作室', 'Dubbing Studio')}
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-[1.1] tracking-tight">
            <span className="block text-white">
              {tx('影片、遊戲、品牌的', '影视、游戏、品牌的', 'Multilingual Dubbing')}
            </span>
            <span className="block bg-gradient-to-r from-blue-200 via-cyan-200 to-teal-200 bg-clip-text text-transparent">
              {tx('多語配音', '多语配音', 'for Film, Game & Brand')}
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-300 mb-6 max-w-3xl leading-relaxed">
            {tx(
              'AI 速度、真人導演品質。從原始腳本到可直接上線的音檔，30+ 語種。',
              'AI 速度、真人导演品质。从原始脚本到可直接上线的音档，30+ 语种。',
              'AI speed, human-directed quality. From source script to broadcast-ready audio in 30+ languages.'
            )}
          </p>

          <p className="text-base md:text-lg text-gray-400 max-w-3xl leading-relaxed">
            {tx(
              '純 AI 不夠用、全包真人錄音室又太貴 — Onyx 介於兩者之間，AI 處理、真人把關。',
              '纯 AI 不够用、全包真人录音棚又太贵 — Onyx 介于两者之间，AI 处理、真人把关。',
              "Sits between pure AI and full studio: AI does the heavy lifting; our voice directors catch what AI misses."
            )}
          </p>
        </motion.div>
      </section>

      {/* WHY ONYX block */}
      <section className="px-4 sm:px-6 lg:px-8 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto px-6 py-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3"
        >
          <p className="text-base text-gray-300 leading-relaxed">
            {tx(
              'AI 翻譯與初稿生成加速了案件流程，但純 AI 輸出不夠用 — 發音偏差、情緒平淡、文化錯位都很常見。',
              'AI 翻译与初稿生成加速了项目流程，但纯 AI 输出不够用 — 发音偏差、情绪平淡、文化错位都很常见。',
              "AI translation and draft generation speed up the workflow, but pure-AI output isn't enough — pronunciation drift, flat emotion, and cultural misfit are common."
            )}
          </p>
          <p className="text-base text-gray-300 leading-relaxed">
            {tx(
              '我們的價值在「真人聲音導演 + 配音員」最終把關，每分鐘都過耳朵，確保情緒與文化都到位。',
              '我们的价值在「真人声音导演 + 配音员」最终把关，每分钟都过耳朵，确保情绪与文化都到位。',
              'Our value: human voice director + voice actors as the final quality gate. Every minute is reviewed for emotion and cultural fit.'
            )}
          </p>
          <p className="text-base text-gray-400 leading-relaxed">
            {tx(
              '適合大型在地化：電影、戲劇、遊戲、e-learning、品牌全球發佈 — 純 AI 太粗糙、全真人又太貴的中段需求。',
              '适合大型本地化：电影、戏剧、游戏、e-learning、品牌全球发布 — 纯 AI 太粗糙、全真人又太贵的中段需求。',
              "Built for large localization — film, drama, game, e-learning, global brand rollout — anywhere pure AI is too rough and full studio is too expensive."
            )}
          </p>
        </motion.div>
      </section>

      {/* LANGUAGES */}
      <section className="px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-10 text-center"
          >
            <p className="text-xs font-semibold tracking-[0.25em] uppercase text-blue-300 mb-3">
              {tx('30+ 語種', '30+ 语种', '30+ Languages')}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
              {tx(
                '從歐美主流到阿拉伯方言、亞語小眾',
                '从欧美主流到阿拉伯方言、亚语小众',
                'Western to Arabic dialects to Asian niches'
              )}
            </h2>
            <p className="text-gray-400 text-base max-w-3xl mx-auto">
              {tx(
                '涵蓋全球主要市場 — 沒列到的小語種歡迎詢問。',
                '涵盖全球主要市场 — 没列到的小语种欢迎询问。',
                'Major global markets covered — niche languages on request.'
              )}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {languageRegions.map((r, i) => (
              <motion.div
                key={r.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-6 hover:border-white/[0.16] transition-colors"
              >
                <h3 className="text-white font-semibold text-base mb-2 tracking-tight">{r.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{r.list}</p>
              </motion.div>
            ))}
          </div>

          <p className="mt-6 text-sm text-gray-500 text-center">
            {tx(
              '其他小語種（泰、越、印尼、菲律賓他加祿、土耳其等）— 歡迎詢問。',
              '其他小语种（泰、越、印尼、菲律宾他加禄、土耳其等）— 欢迎询问。',
              'Other languages (Thai, Vietnamese, Indonesian, Tagalog, Turkish, etc.) — please ask.'
            )}
          </p>
        </div>
      </section>

      {/* WORKFLOW */}
      <section className="px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-3xl md:text-4xl font-bold text-white mb-10 tracking-tight text-center"
          >
            {tx('工作流程', '工作流程', 'Workflow')}
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {workflow.map((w, i) => {
              const Icon = w.icon;
              return (
                <motion.div
                  key={w.num}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="relative rounded-2xl bg-white/[0.03] border border-white/[0.08] p-7"
                >
                  <div className="flex items-baseline gap-3 mb-4">
                    <span className="font-mono text-xs tracking-[0.25em] text-blue-300/70">{w.num}</span>
                    <Icon className="w-5 h-5 text-blue-300" />
                  </div>
                  <h3 className="text-white font-bold text-lg mb-2 tracking-tight">{w.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{w.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section className="px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-3xl md:text-4xl font-bold text-white mb-10 tracking-tight text-center"
          >
            {tx('我們的能力', '我们的能力', 'Capabilities')}
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {capabilities.map((c, i) => {
              const Icon = c.icon;
              return (
                <motion.div
                  key={c.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-7"
                >
                  <Icon className="w-6 h-6 text-blue-300 mb-4" />
                  <h3 className="text-white font-bold text-lg mb-2 tracking-tight">{c.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{c.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* TRANSPARENCY */}
      <section className="px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto px-6 py-6 rounded-2xl bg-white/[0.02] border border-white/10"
        >
          <h3 className="text-lg font-bold text-white mb-3">
            {tx('關於我們的製作流程', '关于我们的制作流程', 'About Our Production Process')}
          </h3>
          <p className="text-sm text-gray-300 leading-relaxed">
            {tx(
              'Onyx 使用 AI 翻譯與初稿生成工具加速流程，真人聲音導演與配音員是品質的最終把關者。所有交付檔案都經真人審聽，確保發音、情緒、文化適配無誤。',
              'Onyx 使用 AI 翻译与初稿生成工具加速流程，真人声音导演与配音员是品质的最终把关者。所有交付档案都经真人审听，确保发音、情绪、文化适配无误。',
              'Onyx uses AI translation and draft tools to accelerate the workflow. Our human voice director and voice actors are the final quality gate — every delivery is reviewed for pronunciation, emotion, and cultural fit.'
            )}
          </p>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="px-4 sm:px-6 lg:px-8 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto rounded-2xl bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent border border-blue-400/20 p-10 md:p-12 text-center"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
            {tx('送出配音案件需求', '送出配音项目需求', 'Send your dubbing brief')}
          </h2>
          <p className="text-gray-300 mb-8 leading-relaxed">
            {tx(
              '告訴我們原語、目標語種、時長、時程，24 小時內回覆報價。',
              '告诉我们原语、目标语种、时长、时程，24 小时内回复报价。',
              'Tell us source language, target languages, duration, and timeline. Quote within 24 hours.'
            )}
          </p>
          <Link
            href="/dubbing/brief"
            className="inline-flex items-center gap-2 rounded-full bg-white text-black px-8 py-4 font-semibold hover:bg-gray-100 transition-colors"
          >
            {tx('送出配音需求', '送出配音需求', 'Submit dubbing brief')}
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </Link>
        </motion.div>
      </section>

      <Footer />
    </main>
  );
}
