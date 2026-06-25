'use client';

/**
 * /apply — Partner Network entry index.
 *
 * Replaces what used to be the standalone voice-talent application
 * (now at /apply/voice). The new /apply is a router page that lets
 * applicants pick which of the 4 partner types they're applying as:
 *
 *   01 Voice Talent          → /apply/voice    (individual VOs / singers)
 *   02 Studio Partnership    → /apply/studio   (recording-room partners)
 *   03 Session Director      → /apply/director (per-language directors)
 *   04 Proofreader / QA      → /apply/proofreader (linguistic QA — credentials must be verifiable)
 *
 * Linked from the global Footer (label changed from "Join Talent Roster"
 * to "Partner Network") and from the /data Partner Network section.
 */

import { motion } from 'framer-motion';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ArrowRight, UserPlus, Building2, UserCheck, FileSearch } from 'lucide-react';
import Footer from '@/components/landing/Footer';

export default function ApplyIndexPage() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  const paths = [
    {
      num: '01', icon: UserPlus, href: '/apply/talent',
      title: tx('Voice Talent / 配音人才', 'Voice Talent / 配音人才', 'Voice Talent'),
      desc: tx(
        '個人配音員 / 歌手加入 Onyx 真人配音陣容 — 廣告、旁白、遊戲、角色配音。',
        '个人配音员 / 歌手加入 Onyx 真人配音阵容 — 广告、旁白、游戏、角色配音。',
        'Individual voice actors / singers joining the Onyx human-voice roster — commercial, narration, games, character.'
      ),
    },
    {
      num: '02', icon: Building2, href: '/apply/studio',
      title: tx('Studio Partnership / 錄音室合作', 'Studio Partnership / 录音室合作', 'Studio Partnership'),
      desc: tx(
        '全球錄音室合作 — 符合 TTS 規格(48k / 24-bit / -70dBFS / treated room)。',
        '全球录音室合作 — 符合 TTS 规格(48k / 24-bit / -70dBFS / treated room)。',
        'Global studios meeting TTS-grade specs (48k / 24-bit / -70dBFS / treated room).'
      ),
    },
    {
      num: '03', icon: UserCheck, href: '/apply/director',
      title: tx('Session Director / 聲音導演', 'Session Director / 声音导演', 'Session Director'),
      desc: tx(
        '各語種聲音導演 — 母語直接帶 directed session、引導表演與情緒。',
        '各语种声音导演 — 母语直接带 directed session、引导表演与情绪。',
        'Per-language session directors — native-speaker direction of performance, emotion, and pacing.'
      ),
    },
    {
      num: '04', icon: FileSearch, href: '/apply/proofreader',
      title: tx('Proofreader / 校對', 'Proofreader / 校对', 'Proofreader / Language QA'),
      desc: tx(
        '各語種校對與語言品質審核 — 需提供可驗證的學經歷、認證與過往案件。',
        '各语种校对与语言质量审核 — 需提供可验证的学经历、认证与过往项目。',
        'Per-language proofreading and linguistic QA — verifiable credentials, certifications, and past projects required.'
      ),
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
          className="relative max-w-4xl mx-auto text-center"
        >
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-500/[0.08] px-5 py-2">
            <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" />
            <span className="text-sm tracking-wide text-gray-100 font-medium">
              {tx('合作網絡', '合作网络', 'Partner Network')}
            </span>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold mb-5 leading-[1.1] tracking-tight text-white">
            {tx('Onyx Partner Network', 'Onyx Partner Network', 'Onyx Partner Network')}
          </h1>

          <p className="text-lg md:text-xl text-gray-300 mb-3 max-w-2xl mx-auto leading-relaxed">
            {tx(
              '我們持續擴大全球合作網絡 — 四條加入路徑,選擇最符合的一條。',
              '我们持续扩大全球合作网络 — 四条加入路径,选择最符合的一条。',
              "We continuously expand our global partner network. Four paths to join — pick the one that fits."
            )}
          </p>
        </motion.div>
      </section>

      {/* 4 paths */}
      <section className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {paths.map((p, i) => {
              const Icon = p.icon;
              return (
                <Link key={p.num} href={p.href} className="block h-full">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ duration: 0.5, delay: i * 0.08 }}
                    className="group h-full rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.20] p-7 transition-all"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <span className="font-mono text-xs tracking-[0.25em] text-amber-300/70">{p.num}</span>
                      <Icon className="w-5 h-5 text-amber-300" />
                    </div>
                    <h3 className="text-white font-bold text-xl mb-2 tracking-tight">{p.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed mb-5">{p.desc}</p>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                      <span>{tx('開始申請', '开始申请', 'Start application')}</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </motion.div>
                </Link>
              );
            })}
          </div>

          <p className="mt-10 text-sm text-gray-500 text-center max-w-3xl mx-auto leading-relaxed">
            {tx(
              '申請後 Onyx 製作團隊會在 3-5 個工作日內審核並回覆。校對與語言 QA 申請需提供可驗證的學經歷與過往案件 — Onyx 對外承接案件的品質責任不允許未驗證的工作者。',
              '申请后 Onyx 制作团队会在 3-5 个工作日内审核并回复。校对与语言 QA 申请需提供可验证的学经历与过往项目 — Onyx 对外承接项目的质量责任不允许未验证的工作者。',
              "Applications are reviewed and replied to within 3-5 business days. Proofreader / Language QA applications require verifiable credentials and past project history — Onyx's quality commitment to clients doesn't allow unverified contributors."
            )}
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
