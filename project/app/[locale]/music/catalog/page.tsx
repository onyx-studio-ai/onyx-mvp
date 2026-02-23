'use client';

import { useState } from 'react';
import { Music2, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Footer from '@/components/landing/Footer';
import VibesGrid from '@/components/catalog/VibesGrid';
import TalentsGrid from '@/components/catalog/TalentsGrid';

type CatalogMode = 'vibes' | 'artists';

export default function MusicCatalogPage() {
  const [mode, setMode] = useState<CatalogMode>('vibes');
  const t = useTranslations('musicCatalog');

  return (
    <main className="min-h-screen bg-[#050505] text-white overflow-x-hidden pt-28">
      <section className="relative py-16 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-200 via-cyan-200 to-teal-200 bg-clip-text text-transparent">
              {t('pageTitle')}
            </h1>

            <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto mb-12">
              {t('pageSubtitle')}
            </p>

            <div className="inline-flex items-center p-1.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <button
                onClick={() => setMode('vibes')}
                className={`px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 flex items-center gap-3 ${
                  mode === 'vibes'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/50'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Music2 className="w-5 h-5" />
                {t('instrumentalVibes')}
              </button>
              <button
                onClick={() => setMode('artists')}
                className={`px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 flex items-center gap-3 ${
                  mode === 'artists'
                    ? 'bg-gradient-to-r from-orange-600 to-rose-600 text-white shadow-lg shadow-orange-500/50'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <User className="w-5 h-5" />
                {t('vocalArtists')}
              </button>
            </div>
          </div>

          <div className="mb-20">
            {mode === 'vibes' ? <VibesGrid /> : <TalentsGrid />}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
