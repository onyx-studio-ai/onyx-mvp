'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight, Mic, Music, Video, Database } from 'lucide-react';
import { motion } from 'framer-motion';
import Footer from '@/components/landing/Footer';
import ContactModal from '@/components/ContactModal';

export default function LobbyPage() {
  const t = useTranslations('lobby');
  const [isContactOpen, setIsContactOpen] = useState(false);
  const products = [
    {
      id: 'voice',
      title: t('voiceTitle'),
      description: t('voiceDesc'),
      icon: Mic,
      href: '/voice',
      type: 'link' as const,
      gradient: 'from-blue-600/20 to-cyan-600/20',
      borderGradient: 'from-blue-500 to-cyan-500',
      featured: true,
    },
    {
      id: 'music',
      title: t('musicTitle'),
      description: t('musicDesc'),
      icon: Music,
      href: '/music',
      type: 'link' as const,
      gradient: 'from-purple-600/20 to-pink-600/20',
      borderGradient: 'from-purple-500 to-pink-500',
      featured: false,
    },
    {
      id: 'video',
      title: t('videoTitle'),
      description: t('videoDesc'),
      icon: Video,
      href: '#',
      type: 'contact' as const,
      gradient: 'from-emerald-600/20 to-teal-600/20',
      borderGradient: 'from-emerald-500 to-teal-500',
      featured: false,
    },
    {
      id: 'data',
      title: t('dataTitle'),
      description: t('dataDesc'),
      icon: Database,
      href: '#',
      type: 'contact' as const,
      gradient: 'from-orange-600/20 to-red-600/20',
      borderGradient: 'from-orange-500 to-red-500',
      featured: false,
    },
  ];

  return (
    <main className="min-h-screen bg-[#050505] text-white overflow-x-hidden pt-28">
      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-6xl md:text-8xl font-bold mb-8 bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-transparent">
              {t('brandName')}
            </h1>

            <div className="mb-8 inline-block">
              <div className="px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600/10 via-cyan-600/10 to-blue-600/10 border border-blue-500/30 backdrop-blur-sm">
                <p className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-blue-200 via-cyan-200 to-blue-200 bg-clip-text text-transparent">
                  {t('tagline')}
                </p>
              </div>
            </div>

            <p className="text-lg md:text-xl text-gray-400 mb-3 max-w-3xl mx-auto">
              {t('subtitle')}
            </p>
            <p className="text-sm md:text-base text-gray-500 max-w-2xl mx-auto">
              {t('description')}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Product Grid */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 mb-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {products.map((product, index) => {
              const Icon = product.icon;
              const CardContent = (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className={`group relative h-full rounded-2xl bg-gradient-to-br ${product.gradient} border border-white/10 hover:border-white/20 transition-all duration-500 overflow-hidden ${
                    product.type === 'link' || product.type === 'contact' ? 'cursor-pointer' : ''
                  }`}
                >
                  {/* Gradient Border Effect */}
                  <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r ${product.borderGradient} blur-xl -z-10`} />

                  <div className="relative h-full p-8 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between mb-4">
                        <div className={`p-3 rounded-xl bg-gradient-to-br ${product.gradient} border border-white/20`}>
                          <Icon className="w-8 h-8" />
                        </div>
                        {product.featured && (
                          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {t('flagship')}
                          </span>
                        )}
                      </div>

                      <h3 className="text-2xl lg:text-3xl font-bold mb-3 group-hover:text-white transition-colors">
                        {product.title}
                      </h3>
                      <p className="text-gray-400 text-base lg:text-lg mb-6">
                        {product.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-sm font-medium text-white/70 group-hover:text-white transition-colors">
                      {product.type === 'link' ? (
                        <>
                          <span>{t('explore')}</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </>
                      ) : (
                        <>
                          <span>{t('chatSpecialist')}</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Hover Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                </motion.div>
              );

              if (product.type === 'link') {
                return (
                  <Link key={product.id} href={product.href} className="block h-[320px] lg:h-[360px]">
                    {CardContent}
                  </Link>
                );
              } else {
                return (
                  <button
                    key={product.id}
                    onClick={() => setIsContactOpen(true)}
                    className="block h-[320px] lg:h-[360px] w-full text-left"
                  >
                    {CardContent}
                  </button>
                );
              }
            })}
          </div>
        </div>
      </section>

      <Footer />
      <ContactModal isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} department="HELLO" source="homepage" />
    </main>
  );
}
