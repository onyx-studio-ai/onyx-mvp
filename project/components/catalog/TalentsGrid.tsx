'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowRight, Play } from 'lucide-react';
import { type Talent } from '@/lib/supabase';

import { Button } from '@/components/ui/button';
import CatalogAudioPlayer from './CatalogAudioPlayer';

export default function TalentsGrid() {
  const t = useTranslations('talent');
  const [talents, setTalents] = useState<Talent[]>([]);
  const [filteredTalents, setFilteredTalents] = useState<Talent[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [selectedGender, setSelectedGender] = useState('all');
  const [selectedStyle, setSelectedStyle] = useState('all');

  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [availableStyles, setAvailableStyles] = useState<string[]>([]);

  useEffect(() => {
    loadTalents();
  }, []);

  useEffect(() => {
    let filtered = [...talents];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (talent) =>
          talent.name.toLowerCase().includes(q) ||
          talent.bio?.toLowerCase().includes(q) ||
          talent.tags?.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    if (selectedLanguage !== 'all') {
      filtered = filtered.filter((talent) =>
        talent.languages?.includes(selectedLanguage)
      );
    }

    if (selectedGender !== 'all') {
      filtered = filtered.filter((talent) =>
        talent.tags?.some((tag: string) => tag.toLowerCase() === selectedGender.toLowerCase())
      );
    }

    if (selectedStyle !== 'all') {
      filtered = filtered.filter((talent) =>
        talent.tags?.includes(selectedStyle)
      );
    }

    setFilteredTalents(filtered);
  }, [talents, searchQuery, selectedLanguage, selectedGender, selectedStyle]);

  const loadTalents = async () => {
    try {
      const response = await fetch('/api/talents?type=singer');
      if (!response.ok) throw new Error('Failed to fetch talents');
      const data = await response.json();

      const talentsData = (data || []) as Talent[];

      const languages = new Set<string>();
      const styles = new Set<string>();

      talentsData.forEach((talent) => {
        talent.languages?.forEach((lang: string) => languages.add(lang));
        talent.tags?.forEach((tag: string) => styles.add(tag));
      });

      setAvailableLanguages(Array.from(languages).sort());
      setAvailableStyles(Array.from(styles).sort());
      setTalents(talentsData);
    } catch (error) {
      console.error('Error loading talents:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-16 text-gray-400 text-lg">
        {t('loadingVocalArtists')}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-8">
      {/* Filters sidebar */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 h-fit lg:sticky lg:top-28 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="mb-5">
          <label className="block font-semibold text-sm text-white mb-2">{t('search')}</label>
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-white/10 rounded-lg text-sm bg-black/40 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:bg-black/60 transition-all"
          />
        </div>

        <div className="mb-5">
          <label className="block font-semibold text-sm text-white mb-2">{t('language')}</label>
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="w-full px-3 py-2 border border-white/10 rounded-lg text-sm bg-black/40 text-white focus:outline-none focus:border-cyan-500 transition-all"
          >
            <option value="all">{t('allLanguages')}</option>
            {availableLanguages.map((lang) => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>

        <div className="mb-5">
          <label className="block font-semibold text-sm text-white mb-2">{t('gender')}</label>
          <select
            value={selectedGender}
            onChange={(e) => setSelectedGender(e.target.value)}
            className="w-full px-3 py-2 border border-white/10 rounded-lg text-sm bg-black/40 text-white focus:outline-none focus:border-cyan-500 transition-all"
          >
            <option value="all">{t('allGenders')}</option>
            <option value="male">{t('male')}</option>
            <option value="female">{t('female')}</option>
            <option value="non_binary">{t('nonBinary')}</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold text-sm text-white mb-2">{t('style')}</label>
          <select
            value={selectedStyle}
            onChange={(e) => setSelectedStyle(e.target.value)}
            className="w-full px-3 py-2 border border-white/10 rounded-lg text-sm bg-black/40 text-white focus:outline-none focus:border-cyan-500 transition-all"
          >
            <option value="all">{t('allStyles')}</option>
            {availableStyles.map((style) => (
              <option key={style} value={style}>{style}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {filteredTalents.length === 0 ? (
          <div className="col-span-full text-center py-16 px-8 text-gray-400 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl">
            {t('noVocalArtistsFound')}
          </div>
        ) : (
          filteredTalents.map((talent) => (
            <div
              key={talent.id}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm hover:border-cyan-500/30 hover:-translate-y-2 transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
            >
              <div className="relative w-full h-[200px] overflow-hidden bg-black/40">
                {talent.headshot_url && (
                  <img
                    src={talent.headshot_url}
                    alt={talent.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                )}
                <div className="absolute bottom-3 right-3 z-10">
                  {talent.sample_url ? (
                    <CatalogAudioPlayer audioUrl={talent.sample_url} />
                  ) : (
                    <button
                      disabled
                      className="w-14 h-14 rounded-full bg-gray-700/60 border-2 border-white/[0.08] flex items-center justify-center text-gray-500 cursor-default"
                      aria-label="No demo available"
                    >
                      <Play className="w-6 h-6 ml-0.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-semibold text-white">{talent.name}</h3>
                  <span className="text-cyan-400 font-semibold text-sm tracking-wide">
                    {t('premiumAddon')}
                  </span>
                </div>

                {talent.tags && talent.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {talent.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 text-xs font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {talent.languages && talent.languages.length > 0 && (
                  <p className="text-gray-500 text-xs mb-3">
                    {talent.languages.join(' · ')}
                  </p>
                )}

                {talent.bio && (
                  <p className="text-gray-400 text-sm leading-relaxed mb-4 line-clamp-2">
                    {talent.bio}
                  </p>
                )}

                <Link href={`/music/create?singer=${talent.id}`}>
                  <Button className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-5 rounded-lg flex items-center justify-center gap-2 transition-colors">
                    {t('startProject')}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
