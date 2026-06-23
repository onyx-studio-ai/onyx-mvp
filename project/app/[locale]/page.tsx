'use client';

/**
 * Homepage / lobby — Onyx Studios landing page.
 *
 * Restructured to align with /music/orchestra, /music/pricing, /dubbing:
 *   1. Hero       — badge + gradient title + lead (single, focused)
 *   2. Why Onyx   — 3-line positioning block
 *   3. Services   — 4 service cards, subtle bg-white/[0.03] styling
 *                   consistent with other pages (not heavy gradient borders)
 *   4. Workflow   — 4-step universal engagement flow
 *   5. Trust      — credentials (2008 / 1,500+ / 30+ / global)
 *   6. Transparency — AI-as-tool statement (matches pricing/dubbing)
 *   7. CTA        — contact / explore plans
 *
 * Mixes useTranslations('lobby') for existing pre-translated keys
 * (brandName, service titles/descriptions, etc.) with inline tx() for
 * new sections — easier to iterate on without messages.json round-trip.
 */

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowRight, Mic, Music2, Globe, Database,
  Send, FileCheck, Headphones, Package,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Footer from '@/components/landing/Footer';
import ContactModal from '@/components/ContactModal';

export default function LobbyPage() {
  const t = useTranslations('lobby');
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  const [isContactOpen, setIsContactOpen] = useState(false);

  const services = [
    {
      id: 'voice', number: '01', icon: Mic, accent: 'text-sky-300',
      title: t('voiceTitle'),
      description: t('voiceDesc'),
      href: '/voice',
      type: 'link' as const,
      featured: true,
    },
    {
      id: 'music', number: '02', icon: Music2, accent: 'text-purple-300',
      title: t('musicTitle'),
      description: t('musicDesc'),
      href: '/music',
      type: 'link' as const,
      featured: false,
    },
    {
      id: 'video', number: '03', icon: Globe, accent: 'text-teal-300',
      title: t('videoTitle'),
      description: t('videoDesc'),
      href: '/dubbing',
      type: 'link' as const,
      featured: false,
    },
    {
      id: 'data', number: '04', icon: Database, accent: 'text-amber-300',
      title: t('dataTitle'),
      description: t('dataDesc'),
      href: '/data',
      type: 'link' as const,
      featured: false,
    },
  ];

  const workflow = [
    {
      num: '01', icon: Send,
      title: tx('詢價', '询价', 'Inquire'),
      desc: tx(
        '送 brief 或填表單，24 小時內回覆方向與報價。',
        '送 brief 或填表单，24 小时内回复方向与报价。',
        'Send brief / form. Direction + quote within 24h.'
      ),
    },
    {
      num: '02', icon: FileCheck,
      title: tx('確認規格', '确认规格', 'Lock specs'),
      desc: tx(
        '製作人與你協作確認方向、編制、交期、授權範圍。',
        '制作人与你协作确认方向、编制、交期、授权范围。',
        'Producer collaborates with you to lock direction, format, timeline, license.'
      ),
    },
    {
      num: '03', icon: Headphones,
      title: tx('製作', '制作', 'Produce'),
      desc: tx(
        '錄音室製作，導演現場把關每個段落。',
        '录音室制作，导演现场把关每个段落。',
        'In-studio production. Director supervises every segment.'
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

  const trust = [
    {
      stat: '2008',
      label: tx('成立至今 17 年',     '成立至今 17 年',     'Established'),
    },
    {
      stat: '1,500+',
      label: tx('配音員陣容',         '配音员阵容',         'Voice talents'),
    },
    {
      stat: '30+',
      label: tx('語種覆蓋',           '语种覆盖',           'Languages'),
    },
    {
      stat: tx('全球', '全球', 'Global'),
      label: tx('接案範圍',           '接案范围',           'Project reach'),
    },
  ];

  return (
    <main className="min-h-screen bg-[#050505] text-white overflow-x-hidden pt-28">

      {/* HERO */}
      <section className="relative px-4 sm:px-6 lg:px-8 pb-12">
        <div className="absolute inset-0 bg-gradient-to-b from-sky-900/10 via-transparent to-transparent pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="relative max-w-5xl mx-auto text-center"
        >
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-sky-300/25 bg-sky-500/[0.08] px-5 py-2">
            <span className="w-2 h-2 rounded-full bg-sky-300 animate-pulse" />
            <span className="text-sm tracking-wide text-gray-100 font-medium">
              {tx('Onyx Studios', 'Onyx Studios', 'Onyx Studios')}
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-[1.1] tracking-tight">
            <span className="block bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-transparent">
              {t('brandName')}
            </span>
            <span className="block bg-gradient-to-r from-sky-200 via-cyan-200 to-blue-300 bg-clip-text text-transparent mt-2">
              {t('tagline')}
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-300 mb-4 max-w-3xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>
          <p className="text-base md:text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            {t('description')}
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
              '自 2008 年起，我們以真人配音為核心，逐步把 AI 工具納入製作流程 — 不是換掉人，是讓人做更多。',
              '自 2008 年起，我们以真人配音为核心，逐步把 AI 工具纳入制作流程 — 不是换掉人，是让人做更多。',
              "Since 2008, we've built around human voice talent, with AI added to the workflow — not as a replacement, but to let humans do more."
            )}
          </p>
          <p className="text-base text-gray-300 leading-relaxed">
            {tx(
              '速度由 AI 提供，品質由製作人最終把關 — 客戶拿到的是經過真人審聽的成品，不是純 AI 輸出。',
              '速度由 AI 提供，品质由制作人最终把关 — 客户拿到的是经过真人审听的成品，不是纯 AI 输出。',
              'AI provides the speed. The producer is the final quality gate — you receive a human-reviewed deliverable, not raw AI output.'
            )}
          </p>
          <p className="text-base text-gray-400 leading-relaxed">
            {tx(
              '1,500+ 配音員、30+ 語種、自有錄音室、全球客戶 — 從廣告、影視、遊戲到 TTS 資料製作，一站交付。',
              '1,500+ 配音员、30+ 语种、自有录音室、全球客户 — 从广告、影视、游戏到 TTS 资料制作，一站交付。',
              '1,500+ talents, 30+ languages, our own studio, global clientele — ads, film, game, TTS data — delivered end-to-end.'
            )}
          </p>
        </motion.div>
      </section>

      {/* SERVICES */}
      <section className="px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-10"
          >
            <p className="text-xs font-semibold tracking-[0.25em] uppercase text-sky-300 mb-3">
              {tx('服務', '服务', 'Services')}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {services.map((service, index) => {
              const Icon = service.icon;
              const CardContent = (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                  className="group relative h-full rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.18] p-7 transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs tracking-[0.25em] text-gray-500">
                        {service.number}
                      </span>
                      <Icon className={`w-5 h-5 ${service.accent}`} />
                    </div>
                    {service.featured && (
                      <span className="px-2.5 py-1 text-[10px] font-semibold rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/25 uppercase tracking-wider">
                        {t('flagship')}
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl md:text-2xl font-bold text-white mb-3 tracking-tight">
                    {service.title}
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed mb-6">
                    {service.description}
                    {service.id === 'voice' && (
                      <>{' '}<span className="text-cyan-300 font-medium">{t('voiceDescHuman')}</span></>
                    )}
                  </p>

                  <div className={`flex items-center gap-1.5 text-sm font-medium ${service.accent} group-hover:opacity-80 transition-opacity`}>
                    <span>{service.type === 'link' ? t('explore') : t('chatSpecialist')}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </motion.div>
              );

              if (service.type === 'link') {
                return (
                  <Link key={service.id} href={service.href} className="block h-full">
                    {CardContent}
                  </Link>
                );
              }
              return (
                <button
                  key={service.id}
                  onClick={() => setIsContactOpen(true)}
                  className="block h-full w-full text-left"
                >
                  {CardContent}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* WORKFLOW */}
      <section className="px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-10"
          >
            <p className="text-xs font-semibold tracking-[0.25em] uppercase text-sky-300 mb-3">
              {tx('流程', '流程', 'Workflow')}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              {tx('從詢價到交付，4 個階段', '从询价到交付，4 个阶段', 'From inquiry to delivery, 4 stages')}
            </h2>
          </motion.div>

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
                    <span className="font-mono text-xs tracking-[0.25em] text-sky-300/70">{w.num}</span>
                    <Icon className="w-5 h-5 text-sky-300" />
                  </div>
                  <h3 className="text-white font-bold text-lg mb-2 tracking-tight">{w.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{w.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* TRUST SIGNALS */}
      <section className="px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="rounded-2xl bg-white/[0.02] border border-white/10 p-8 md:p-10"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-4">
              {trust.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className="text-center"
                >
                  <div className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight">
                    {item.stat}
                  </div>
                  <div className="text-xs md:text-sm text-gray-400 tracking-wide">
                    {item.label}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
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
              'Onyx 把 AI 工具當成製作流程的一部分，真人製作人是品質的最終把關者。各服務線（配音 / 音樂 / 影片配音 / 資料製作）反映的是「真人投入深度」與「授權範圍」的差別 — 我們在每條服務線都明文標示工作方式與使用範圍。',
              'Onyx 把 AI 工具当成制作流程的一部分，真人制作人是品质的最终把关者。各服务线（配音 / 音乐 / 影片配音 / 资料制作）反映的是「真人投入深度」与「授权范围」的差别 — 我们在每条服务线都明文标示工作方式与使用范围。',
              'Onyx uses AI tools as part of the workflow. Our human producer is the final quality gate. Each service line (voice / music / dubbing / data) is a different mix of human involvement and license scope — each is documented openly.'
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
          className="max-w-3xl mx-auto rounded-2xl bg-gradient-to-br from-sky-500/10 via-cyan-500/5 to-transparent border border-sky-400/20 p-10 md:p-12 text-center"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
            {tx('準備開始你的案子?', '准备开始你的项目?', 'Ready to start a project?')}
          </h2>
          <p className="text-gray-300 mb-8 leading-relaxed">
            {tx(
              '告訴我們你的需求 — 配音、音樂、影片配音、TTS 數據都可以。24 小時內回覆方向與報價。',
              '告诉我们你的需求 — 配音、音乐、影片配音、TTS 数据都可以。24 小时内回复方向与报价。',
              "Tell us what you need — voice, music, dubbing, or TTS data. Direction + quote within 24 hours."
            )}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setIsContactOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white text-black px-8 py-4 font-semibold hover:bg-gray-100 transition-colors"
            >
              {tx('聯絡我們', '联系我们', 'Contact us')}
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
            </button>
            <Link
              href="/voice"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-white px-8 py-4 font-semibold transition-colors"
            >
              {tx('看完整服務', '看完整服务', 'Explore services')}
            </Link>
          </div>
        </motion.div>
      </section>

      <Footer />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} department="HELLO" source="homepage" />
    </main>
  );
}
