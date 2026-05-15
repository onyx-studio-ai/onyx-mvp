'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { supabase, type Vibe } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import CatalogAudioPlayer from './CatalogAudioPlayer';

export default function VibesGrid() {
  const t = useTranslations('musicCatalog');
  const [vibes, setVibes] = useState<Vibe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVibes();
  }, []);

  const loadVibes = async () => {
    try {
      const { data, error } = await supabase
        .from('vibes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVibes(data || []);
    } catch (error) {
      console.error('Error loading vibes:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-16 text-gray-400 text-lg">
        {t('loadingInstrumentals')}
      </div>
    );
  }

  if (vibes.length === 0) {
    return (
      <div className="text-center py-16 px-8 text-gray-400 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl">
        {t('noVibes')}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {vibes.map((vibe) => (
        <div
          key={vibe.id}
          className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm hover:border-cyan-500/30 hover:-translate-y-2 transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
        >
          <div className="relative w-full h-[200px] overflow-hidden bg-black/40">
            {vibe.image_url && (
              <img
                src={vibe.image_url}
                alt={vibe.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            )}
            <div className="absolute bottom-3 right-3 z-10">
              <CatalogAudioPlayer audioUrl={vibe.audio_url} />
            </div>
          </div>

          <div className="p-6">
            <h3 className="text-xl font-semibold text-white mb-1">{vibe.title}</h3>
            <p className="text-cyan-400 font-semibold text-sm mb-2">{vibe.genre}</p>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">{vibe.description}</p>
            <Link href={`/music/create?vibe=${vibe.id}`}>
              <Button className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-5 rounded-lg flex items-center justify-center gap-2 transition-colors">
                {t('startProject')}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
