'use client';

/**
 * /data — landing page for Onyx's AI voice data collection service.
 *
 * Positioning intentionally NOT evangelistic about AI. The page reads
 * as an OEM / contract-manufacturing service: "we deliver spec-compliant
 * voice data; you decide what to do with it." This is defensive against
 * the 2026 anti-AI climate (SAG-AFTRA, voice actor lawsuits, deepfake
 * fears) — the page never frames talents as "training fuel" or
 * advocates AI use. Onyx supplies a deliverable; the buyer's use case
 * is their own business.
 *
 * Architectural pattern mirrors /dubbing and /music/orchestra:
 *   hero → why → services (4 cards) → workflow → capabilities →
 *   transparency → partner network → CTA
 *
 * Brand color: amber (matches the homepage data-card accent
 * `text-amber-300`), so customers arriving from the lobby see continuity.
 *
 * Partner Network section near the bottom recruits supply-side
 * (studios + session directors) without undermining client-side
 * credibility — framing is "always expanding our supplier network",
 * not "we have gaps". For client-arriving-from-homepage, it reads as
 * scale; for industry insiders, it reads as a recruitment signal.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  ArrowRight, Mic, MessageCircle, User, Tag,
  Send, Users2, Headphones, Package,
  Settings, Globe, ShieldCheck,
  UserPlus, Building2, UserCheck,
} from 'lucide-react';
import Footer from '@/components/landing/Footer';
import ContactModal from '@/components/ContactModal';

export default function DataPage() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  const [contactOpen, setContactOpen] = useState<null | 'studio' | 'director'>(null);

  // Service types — the 4 distinct revenue streams. Annotation is an
  // explicit card (not buried as a capability) because it's a higher-
  // margin add-on and acknowledging it here primes the customer to
  // request it in the brief.
  const services = [
    {
      num: '01', icon: Mic,
      title: tx('TTS 語料製作', 'TTS 语料制作', 'TTS Voice Data'),
      desc: tx(
        '念稿型訓練語料、多風格、長時數,適合通用 TTS 與多場景部署。',
        '念稿型训练语料、多风格、长时数,适合通用 TTS 与多场景部署。',
        'Scripted training corpora — multi-style, long-form. For general TTS and multi-scenario deployment.'
      ),
    },
    {
      num: '02', icon: User,
      title: tx('Voice Avatar / 聲線克隆', 'Voice Avatar / 声线克隆', 'Voice Avatar / Cloning'),
      desc: tx(
        'Directed session 錄音,授權制交付,適合客服 agent、品牌 voice 部署。',
        'Directed session 录音,授权制交付,适合客服 agent、品牌 voice 部署。',
        'Directed session recording with license-based delivery. For customer-service agents and branded voice deployment.'
      ),
    },
    {
      num: '03', icon: MessageCircle,
      title: tx('對話 / 情緒語料', '对话 / 情绪语料', 'Conversational / Emotion Data'),
      desc: tx(
        '即興 conversational、多輪對話、多情緒範圍,emotion-aware AI 訓練必備。',
        '即兴 conversational、多轮对话、多情绪范围,emotion-aware AI 训练必备。',
        'Improvised conversational, multi-turn dialogue, full emotional range — essential for emotion-aware AI training.'
      ),
    },
    {
      num: '04', icon: Tag,
      title: tx('資料標註與清理', '资料标注与清理', 'Data Annotation & Cleaning'),
      desc: tx(
        '時間軸標註、文字校對、metadata 整理。turnkey 客戶可加購一站處理。',
        '时间轴标注、文字校对、metadata 整理。turnkey 客户可加购一站处理。',
        'Timestamp annotation, transcript proofreading, metadata tagging. Available as a turnkey add-on.'
      ),
    },
  ];

  const workflow = [
    {
      num: '01', icon: Send,
      title: tx('詢價', '询价', 'Inquire'),
      desc: tx(
        'Brief + 語種規格確認,24 小時內回覆方向與報價。',
        'Brief + 语种规格确认,24 小时内回复方向与报价。',
        'Brief + language/spec confirmation. Direction + quote within 24h.'
      ),
    },
    {
      num: '02', icon: Users2,
      title: tx('選聲', '选声', 'Roster'),
      desc: tx(
        '我們提供 studio-managed 聲音池,客戶從中挑選。',
        '我们提供 studio-managed 声音池,客户从中挑选。',
        "We supply the studio-managed roster — you pick from it."
      ),
    },
    {
      num: '03', icon: Headphones,
      title: tx('製作', '制作', 'Produce'),
      desc: tx(
        '導演引導 directed session,規格錄音全程把關。',
        '导演引导 directed session,规格录音全程把关。',
        'Director-led session, spec-compliant recording supervised end-to-end.'
      ),
    },
    {
      num: '04', icon: Package,
      title: tx('交付', '交付', 'Deliver'),
      desc: tx(
        '音檔 + 同意書 + 授權文件,一次交清。',
        '音档 + 同意书 + 授权文件,一次交清。',
        'Audio files + consent + license documents — delivered in one package.'
      ),
    },
  ];

  const capabilities = [
    {
      icon: Settings,
      title: tx('Studio-managed 流程', 'Studio-managed 流程', 'Studio-Managed Workflow'),
      desc: tx(
        '客戶面對一個窗口,Onyx 統包人才、付款、文件 — 不用 onboard 任何個別配音員。',
        '客户面对一个窗口,Onyx 统包人才、付款、文件 — 不用 onboard 任何个别配音员。',
        "One point of contact. We handle the roster, payment, and documentation — clients never onboard individual talents."
      ),
    },
    {
      icon: Globe,
      title: tx('亞語深度覆蓋', '亚语深度覆盖', 'Asian-Language Depth'),
      desc: tx(
        '中文(台 / 陸 / 港粵)、台語、東南亞、印度語系 — 其他平台覆蓋不到的深度。',
        '中文(台 / 陆 / 港粤)、台语、东南亚、印度语系 — 其他平台覆盖不到的深度。',
        'Mandarin (Taiwan / Mainland / HK Cantonese), Hokkien, Southeast Asian, Indian languages — depth other platforms can\'t match.'
      ),
    },
    {
      icon: ShieldCheck,
      title: tx('授權合規交付', '授权合规交付', 'Compliant Licensing'),
      desc: tx(
        'Consent 流程、授權範圍明文、續約結構 — 規格化文件,一次交清。',
        'Consent 流程、授权范围明文、续约结构 — 规格化文件,一次交清。',
        'Consent process, explicit license scope, renewal structure — standardized documentation, delivered together.'
      ),
    },
  ];

  // Partner Network — supply-side recruitment without undermining
  // client-side credibility. Framing is "we are expanding the network"
  // (scale signal), not "we lack these" (gap signal). 02 and 03 use
  // ContactModal as temporary intake until /apply/studio and
  // /apply/director are built in a follow-up commit.
  const partners = [
    {
      num: '01', icon: UserPlus,
      title: tx('Voice Talent', '配音人才', 'Voice Talent'),
      desc: tx(
        '個人配音員加入 Onyx 全球陣容。',
        '个人配音员加入 Onyx 全球阵容。',
        'Individual voice talents joining the Onyx global roster.'
      ),
      action: 'link' as const,
      href: '/apply',
    },
    {
      num: '02', icon: Building2,
      title: tx('Studio Partnership', '录音室合作', 'Studio Partnership'),
      desc: tx(
        '符合 TTS 級規格的全球錄音室合作 — 在當地錄音,穩定性最好。',
        '符合 TTS 级规格的全球录音室合作 — 在当地录音,稳定性最好。',
        'Global studios meeting TTS-grade specs. Local recording = better stability.'
      ),
      action: 'contact' as const,
      kind: 'studio' as const,
    },
    {
      num: '03', icon: UserCheck,
      title: tx('Session Director', '声音导演', 'Session Director'),
      desc: tx(
        '具母語直接帶 directed session 經驗的各語種聲音導演。',
        '具母语直接带 directed session 经验的各语种声音导演。',
        'Native-speaker session directors with directed-session experience, per language.'
      ),
      action: 'contact' as const,
      kind: 'director' as const,
    },
  ];

  return (
    <main className="min-h-screen bg-[#050505] text-white overflow-x-hidden pt-28">

      {/* HERO */}
      <section className="relative px-4 sm:px-6 lg:px-8 pb-12">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-900/10 via-transparent to-transparent pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="relative max-w-5xl mx-auto text-center"
        >
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-500/[0.08] px-5 py-2">
            <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" />
            <span className="text-sm tracking-wide text-gray-100 font-medium">
              {tx('語音資料工作室', '语音资料工作室', 'Voice Data Studio')}
            </span>
          </div>

          {/* h1 — anchors to the homepage brand label "AI 數據採集" so the
              customer arriving from the lobby keeps brand continuity. */}
          <h1 className="text-5xl md:text-7xl font-bold mb-5 leading-[1.1] tracking-tight text-white">
            {tx('AI 數據採集', 'AI 数据采集', 'AI Voice Data')}
          </h1>

          {/* Gradient tagline — craft-focused (錄音室級 + 真人導演) instead
              of AI-evangelist. Defensive framing against anti-AI sentiment. */}
          <p className="text-2xl md:text-4xl font-bold mb-6 bg-gradient-to-r from-amber-200 via-yellow-200 to-orange-200 bg-clip-text text-transparent leading-tight">
            {tx(
              '錄音室級語音資料,真人導演把關',
              '录音室级语音资料,真人导演把关',
              'Studio-grade voice data, director supervised'
            )}
          </p>

          <p className="text-lg md:text-xl text-gray-300 mb-6 max-w-3xl mx-auto leading-relaxed">
            {tx(
              '從錄音到授權文件,一站交付。',
              '从录音到授权文件,一站交付。',
              'From recording to license documentation — delivered in one package.'
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
              '17 年配音導演經驗,知道客戶要的「自然對話 + 情緒真實」是怎麼錄出來的,不是錄音棚朗讀。',
              '17 年配音导演经验,知道客户要的「自然对话 + 情绪真实」是怎么录出来的,不是录音棚朗读。',
              "17 years of voice direction experience. We know how to produce the 'natural conversation + genuine emotion' clients actually need — not studio recitation."
            )}
          </p>
          <p className="text-base text-gray-300 leading-relaxed">
            {tx(
              '1,500+ 配音員 × 30+ 語種 — 亞語深度(台灣、大陸、香港粵語、台語、東南亞、印度)是其他供應端覆蓋不到的。',
              '1,500+ 配音员 × 30+ 语种 — 亚语深度(台湾、大陆、香港粤语、台语、东南亚、印度)是其他供应端覆盖不到的。',
              "1,500+ talents across 30+ languages. Asian-language depth — Taiwan / Mainland Mandarin, Hong Kong Cantonese, Hokkien, Southeast Asian, Indian — that other suppliers can't match."
            )}
          </p>
          <p className="text-base text-gray-400 leading-relaxed">
            {tx(
              'Studio-managed 流程 — 從 directed session、規格錄音、到授權文件,客戶不用 onboard 任何個別配音員。',
              'Studio-managed 流程 — 从 directed session、规格录音、到授权文件,客户不用 onboard 任何个别配音员。',
              'Studio-managed workflow — from directed session to spec recording to license documentation. Clients never onboard individual talents.'
            )}
          </p>
        </motion.div>
      </section>

      {/* SERVICES (4 cards) */}
      <section className="px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-10 text-center"
          >
            <p className="text-xs font-semibold tracking-[0.25em] uppercase text-amber-300 mb-3">
              {tx('服務範圍', '服务范围', 'Service Lines')}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
              {tx('四條語音資料服務線', '四条语音资料服务线', 'Four voice-data service lines')}
            </h2>
            <p className="text-gray-400 text-base max-w-3xl mx-auto">
              {tx(
                '從 TTS 訓練語料、聲線克隆、對話資料到標註清理 — 一個窗口收齊。',
                '从 TTS 训练语料、声线克隆、对话资料到标注清理 — 一个窗口收齐。',
                'TTS corpora, voice cloning, conversational data, annotation & cleaning — all under one roof.'
              )}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {services.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={s.num}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className="rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.18] p-7 transition-all"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="font-mono text-xs tracking-[0.25em] text-amber-300/70">{s.num}</span>
                    <Icon className="w-5 h-5 text-amber-300" />
                  </div>
                  <h3 className="text-white font-bold text-lg mb-2 tracking-tight">{s.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
                </motion.div>
              );
            })}
          </div>
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
                    <span className="font-mono text-xs tracking-[0.25em] text-amber-300/70">{w.num}</span>
                    <Icon className="w-5 h-5 text-amber-300" />
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
                  <Icon className="w-6 h-6 text-amber-300 mb-4" />
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
            {tx('關於授權與合約', '关于授权与合约', 'About Licensing & Contracts')}
          </h3>
          <p className="text-sm text-gray-300 leading-relaxed">
            {tx(
              'Onyx 取得配音員的授權,不買斷;客戶取得授權的是「使用權」,而非聲音所有權。每個案子明文標示:授權範圍(用途場景)、授權期間、客戶範圍 — 配音員、客戶、Onyx 三方權利義務都清楚寫進合約。',
              'Onyx 取得配音员的授权,不买断;客户取得授权的是「使用权」,而非声音所有权。每个案子明文标示:授权范围(用途场景)、授权期间、客户范围 — 配音员、客户、Onyx 三方权利义务都清楚写进合约。',
              "Onyx licenses talent voices — we don't buy them out. Clients receive usage rights, not ownership. Every project documents scope (use case), term (duration), and customer range explicitly — all three parties' rights and obligations are written into the contract."
            )}
          </p>
        </motion.div>
      </section>

      {/* PARTNER NETWORK — supply-side recruitment */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-10 text-center"
          >
            <p className="text-xs font-semibold tracking-[0.25em] uppercase text-amber-300 mb-3">
              {tx('合作網絡', '合作网络', 'Partner Network')}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
              {tx('Onyx Partner Network', 'Onyx Partner Network', 'Onyx Partner Network')}
            </h2>
            <p className="text-gray-400 text-base max-w-3xl mx-auto">
              {tx(
                '我們持續擴大全球錄音室與聲導陣容 — 三條合作路徑。',
                '我们持续扩大全球录音室与声导阵容 — 三条合作路径。',
                'We continually expand our global studio and director network — three partnership paths.'
              )}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {partners.map((p, i) => {
              const Icon = p.icon;
              const Body = (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className="h-full rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.18] p-7 transition-all group"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="font-mono text-xs tracking-[0.25em] text-amber-300/70">{p.num}</span>
                    <Icon className="w-5 h-5 text-amber-300" />
                  </div>
                  <h3 className="text-white font-bold text-lg mb-2 tracking-tight">{p.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed mb-5">{p.desc}</p>
                  <div className="flex items-center gap-1.5 text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                    <span>{tx('申請加入', '申请加入', 'Apply')}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </motion.div>
              );

              if (p.action === 'link') {
                return (
                  <Link key={p.num} href={p.href!} className="block h-full">
                    {Body}
                  </Link>
                );
              }
              return (
                <button
                  key={p.num}
                  onClick={() => setContactOpen(p.kind!)}
                  className="block h-full w-full text-left"
                >
                  {Body}
                </button>
              );
            })}
          </div>

          <p className="mt-8 text-sm text-gray-500 text-center max-w-3xl mx-auto leading-relaxed">
            {tx(
              'Onyx 透過全球錄音室與聲導合作網絡,提供當地規格交付。歡迎符合 TTS 級規格(48k / 24-bit / -70dBFS 底噪 / acoustically treated room)的錄音室,以及具備母語直接帶 directed session 經驗的聲音導演加入。',
              'Onyx 透过全球录音室与声导合作网络,提供当地规格交付。欢迎符合 TTS 级规格(48k / 24-bit / -70dBFS 底噪 / acoustically treated room)的录音室,以及具备母语直接带 directed session 经验的声音导演加入。',
              'Onyx delivers local-spec recording through a global studio + director network. We welcome studios meeting TTS-grade specs (48k / 24-bit / -70dBFS noise floor / acoustically treated room) and native-speaker session directors with directed-session experience.'
            )}
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 sm:px-6 lg:px-8 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-400/20 p-10 md:p-12 text-center"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
            {tx('送出語音資料需求', '送出语音资料需求', 'Send your voice-data brief')}
          </h2>
          <p className="text-gray-300 mb-8 leading-relaxed">
            {tx(
              '告訴我們語種、規模、用途、時程,24 小時內回覆方向與報價。',
              '告诉我们语种、规模、用途、时程,24 小时内回复方向与报价。',
              'Tell us languages, scale, use case, and timeline. Direction + quote within 24 hours.'
            )}
          </p>
          <Link
            href="/data/brief"
            className="inline-flex items-center gap-2 rounded-full bg-white text-black px-8 py-4 font-semibold hover:bg-gray-100 transition-colors"
          >
            {tx('送出資料需求', '送出资料需求', 'Submit voice-data brief')}
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </Link>
        </motion.div>
      </section>

      <Footer />
      {/* ContactModal department enum is limited to HELLO/PRODUCTION/etc — we
          use HELLO and disambiguate Studio vs Director via the source field
          so the inbox routing and the spawned-task title can split them. */}
      <ContactModal
        isOpen={contactOpen !== null}
        onClose={() => setContactOpen(null)}
        department="HELLO"
        source={contactOpen === 'studio' ? 'data-studio-partner' : 'data-session-director'}
      />
    </main>
  );
}
