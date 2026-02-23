'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { languages, getVoicesForLanguage, findLanguageByVoiceName, Voice, voicesByLanguage } from '@/lib/voices';
import { User, UserRound, Play, Activity, Wand2, ChevronDown, X, Globe, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import Footer from '@/components/landing/Footer';

const POPULAR_CODES = ['en', 'zh', 'yue', 'ja', 'ko', 'th', 'es', 'fr'];
const popularLanguages = languages.filter(l => POPULAR_CODES.includes(l.code));
const moreLanguages = languages.filter(l => !POPULAR_CODES.includes(l.code));

const LANG_CODE_MAP: Record<string, string> = {
  'english': 'en', 'mandarin': 'zh', 'mandarin chinese': 'zh', 'chinese': 'zh',
  'cantonese': 'yue', 'chinese (cantonese)': 'yue', 'chinese (mandarin)': 'zh',
  'japanese': 'ja', 'korean': 'ko', 'thai': 'th',
  'vietnamese': 'vi', 'indonesian': 'id', 'malay': 'ms',
  'tagalog': 'tl', 'tagalog (filipino)': 'tl', 'filipino': 'tl',
  'hindi': 'hi', 'tamil': 'ta', 'bengali': 'bn',
  'arabic': 'ar', 'persian': 'fa', 'persian (farsi)': 'fa', 'farsi': 'fa',
  'spanish': 'es', 'portuguese': 'pt', 'french': 'fr', 'german': 'de',
  'italian': 'it', 'dutch': 'nl', 'russian': 'ru', 'polish': 'pl',
  'turkish': 'tr', 'swedish': 'sv', 'norwegian': 'no', 'danish': 'da',
  'finnish': 'fi', 'albanian': 'sq', 'czech': 'cs', 'greek': 'el',
  'hebrew': 'he', 'hungarian': 'hu', 'romanian': 'ro', 'ukrainian': 'uk',
  'burmese': 'my', 'khmer': 'km', 'lao': 'lo', 'mongolian': 'mn',
  'nepali': 'ne', 'sinhala': 'si', 'urdu': 'ur', 'swahili': 'sw',
};

function resolveLangCode(lang: string): string {
  const lower = lang.toLowerCase().trim();
  if (LANG_CODE_MAP[lower]) return LANG_CODE_MAP[lower];

  const parenMatch = lower.match(/\(([^)]+)\)/);
  if (parenMatch) {
    const inner = parenMatch[1].trim();
    if (LANG_CODE_MAP[inner]) return LANG_CODE_MAP[inner];
  }

  const baseName = lower.replace(/\s*\([^)]*\)\s*/g, '').trim();
  if (LANG_CODE_MAP[baseName]) return LANG_CODE_MAP[baseName];

  return lower;
}

function talentToVoice(talent: any): Voice & { langCodes: string[] } {
  const langCodes: string[] = (talent.languages || []).map((lang: string) => resolveLangCode(lang));

  return {
    id: `db_${talent.id}`,
    name: talent.name,
    gender: (talent.gender || 'male').toLowerCase() as 'male' | 'female',
    description: talent.bio || talent.tags?.join(', ') || 'Professional voice talent',
    audioPreviewUrl: talent.sample_url || talent.demo_urls?.[0]?.url || '',
    langCodes,
  };
}

export default function VoicesPage() {
  const t = useTranslations('voices');
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const langDisplayName = (lang: typeof languages[number]) => isZh ? lang.zhName : lang.name;
  const genderLabel = (g: string) => isZh ? (g === 'male' ? '男聲' : '女聲') : g.toUpperCase();
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [langSearch, setLangSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dbVoicesByLang, setDbVoicesByLang] = useState<Record<string, Voice[]>>({});
  const [loadingDb, setLoadingDb] = useState(true);

  const fetchDbTalents = useCallback(async () => {
    try {
      const res = await fetch('/api/talents?type=vo');
      if (!res.ok) return;
      const talents = await res.json();
      const mapped: Record<string, Voice[]> = {};
      for (const t of talents) {
        const v = talentToVoice(t);
        for (const code of v.langCodes) {
          if (!mapped[code]) mapped[code] = [];
          mapped[code].push(v);
        }
        if (v.langCodes.length === 0) {
          if (!mapped['en']) mapped['en'] = [];
          mapped['en'].push(v);
        }
      }
      setDbVoicesByLang(mapped);
    } catch (err) {
      console.error('Failed to fetch talents:', err);
    } finally {
      setLoadingDb(false);
    }
  }, []);

  useEffect(() => {
    fetchDbTalents();
  }, [fetchDbTalents]);

  const mergedVoicesByLang: Record<string, Voice[]> = { ...voicesByLanguage };
  for (const [code, voices] of Object.entries(dbVoicesByLang)) {
    if (!mergedVoicesByLang[code]) {
      mergedVoicesByLang[code] = [];
    }
    const existingIds = new Set(mergedVoicesByLang[code].map(v => v.id));
    for (const v of voices) {
      if (!existingIds.has(v.id)) {
        mergedVoicesByLang[code].push(v);
      }
    }
  }

  const allVoices: Voice[] = [];
  const allIds = new Set<string>();
  for (const voices of Object.values(mergedVoicesByLang)) {
    for (const v of voices) {
      if (!allIds.has(v.id)) {
        allIds.add(v.id);
        allVoices.push(v);
      }
    }
  }

  const availableVoices = selectedLanguage === 'all' ? allVoices : (mergedVoicesByLang[selectedLanguage] || []);
  const selectedLangObj = selectedLanguage === 'all' ? { code: 'all', name: 'All' } : languages.find(l => l.code === selectedLanguage);
  const isFromMore = selectedLanguage !== 'all' && !POPULAR_CODES.includes(selectedLanguage);

  useEffect(() => {
    return () => { stopCurrentAudio(); };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    if (moreOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [moreOpen]);

  const stopCurrentAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
      setPlayingVoiceId(null);
      setAudioProgress(0);
    }
  };

  const toggleAudioPreview = (voice: Voice, e: React.MouseEvent) => {
    e.stopPropagation();

    if (playingVoiceId === voice.id) {
      stopCurrentAudio();
      return;
    }

    stopCurrentAudio();

    const audio = new Audio(voice.audioPreviewUrl);

    audio.addEventListener('ended', () => {
      setPlayingVoiceId(null);
      setAudioProgress(0);
      currentAudioRef.current = null;
    });

    audio.addEventListener('timeupdate', () => {
      if (audio.duration) {
        setAudioProgress((audio.currentTime / audio.duration) * 100);
      }
    });

    audio.addEventListener('error', () => {
      setPlayingVoiceId(null);
      setAudioProgress(0);
      currentAudioRef.current = null;
      toast.error(t('audioUnavailable'), {
        description: t('audioLoadError', { name: voice.name }),
        duration: 2000,
      });
    });

    audio.play().catch(() => {
      setPlayingVoiceId(null);
      currentAudioRef.current = null;
    });

    currentAudioRef.current = audio;
    setPlayingVoiceId(voice.id);
  };

  const handleLanguageChange = (newLanguage: string) => {
    setSelectedLanguage(newLanguage);
    setMoreOpen(false);
    setLangSearch('');
    stopCurrentAudio();
  };

  const handleUseVoice = (voice: Voice) => {
    const actualLang = selectedLanguage === 'all'
      ? (findLanguageByVoiceName(voice.name) || 'en')
      : selectedLanguage;
    const params = new URLSearchParams({
      voiceId: voice.id,
      voiceName: voice.name,
      lang: actualLang,
    });
    router.push(`/voice/create?${params.toString()}`);
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white overflow-x-hidden pt-20">
      <div className="relative py-20 px-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.05),transparent_50%)]" />

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              {t('pageTitle')}
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              {t('pageSubtitle')}
            </p>
          </div>

          {/* Language Filter */}
          <div className="mb-12">
            <label className="block text-sm font-medium text-gray-400 mb-4">
              {t('filterByLanguage')}
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => handleLanguageChange('all')}
                className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                  selectedLanguage === 'all'
                    ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                }`}
              >
                {t('all')}
              </button>
              {popularLanguages.map((lang) => {
                const hasVoices = (mergedVoicesByLang[lang.code]?.length || 0) > 0;
                return (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                      selectedLanguage === lang.code
                        ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                        : hasVoices
                          ? 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                          : 'bg-white/[0.02] text-gray-600 border border-white/5 cursor-default'
                    }`}
                  >
                    {langDisplayName(lang)}
                    {!hasVoices && !loadingDb && <span className="ml-1.5 text-xs text-gray-600">{t('comingSoon')}</span>}
                  </button>
                );
              })}

              {/* "More" selected pill — shown when a non-popular language is active */}
              {isFromMore && selectedLangObj && (
                <button
                  onClick={() => handleLanguageChange('en')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium bg-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                >
                  {selectedLangObj.name}
                  <X className="w-3.5 h-3.5 opacity-70" />
                </button>
              )}

              {/* More Languages dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setMoreOpen(!moreOpen)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap border ${
                    moreOpen
                      ? 'bg-white/10 text-white border-white/20'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border-white/10'
                  }`}
                >
                  {t('moreLanguages')}
                  <ChevronDown className={`w-4 h-4 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
                </button>

                {moreOpen && (
                  <div className="absolute top-full left-0 mt-2 w-64 rounded-xl bg-[#111] border border-white/10 shadow-2xl shadow-black/50 z-50">
                    <div className="p-2 border-b border-white/5">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                        <input
                          type="text"
                          value={langSearch}
                          onChange={(e) => setLangSearch(e.target.value)}
                          placeholder={t('searchLanguages')}
                          className="w-full pl-9 pr-3 py-2 bg-white/5 rounded-lg text-sm text-white placeholder:text-gray-600 outline-none focus:ring-1 focus:ring-white/20"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="p-2 max-h-64 overflow-y-auto">
                      {moreLanguages
                        .filter((lang) => lang.name.toLowerCase().includes(langSearch.toLowerCase()) || lang.zhName.includes(langSearch))
                        .map((lang) => {
                          const hasVoices = (mergedVoicesByLang[lang.code]?.length || 0) > 0;
                          return (
                            <button
                              key={lang.code}
                              onClick={() => handleLanguageChange(lang.code)}
                              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-between ${
                                selectedLanguage === lang.code
                                  ? 'bg-blue-600/20 text-blue-300'
                                  : hasVoices
                                    ? 'text-gray-300 hover:bg-white/5 hover:text-white'
                                    : 'text-gray-600'
                              }`}
                            >
                              {langDisplayName(lang)}
                              {!hasVoices && <span className="text-xs text-gray-600">{t('comingSoon')}</span>}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {availableVoices.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableVoices.map((voice: Voice) => (
                <div
                  key={voice.id}
                  className="relative p-6 rounded-2xl border-2 border-white/10 bg-gradient-to-b from-[#0a0a0a] to-[#0f0f0f] hover:border-white/20 transition-all group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {voice.gender === 'male' ? (
                        <User className="w-6 h-6 text-blue-400" />
                      ) : (
                        <UserRound className="w-6 h-6 text-pink-400" />
                      )}
                      <div>
                        <h3 className="text-xl font-bold text-white">{voice.name}</h3>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">
                          {genderLabel(voice.gender)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => toggleAudioPreview(voice, e)}
                        className={`
                          p-3 rounded-lg transition-all
                          ${
                            playingVoiceId === voice.id
                              ? 'bg-blue-500 hover:bg-blue-600 text-white'
                              : 'bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white'
                          }
                        `}
                        title={playingVoiceId === voice.id ? t('stopPreview') : t('playPreview')}
                      >
                        {playingVoiceId === voice.id ? (
                          <Activity className="w-5 h-5 animate-pulse" />
                        ) : (
                          <Play className="w-5 h-5" />
                        )}
                      </button>
                      {playingVoiceId === voice.id && (
                        <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-blue-400 rounded-full transition-[width] duration-200"
                            style={{ width: `${audioProgress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed mb-4">
                    {voice.description}
                  </p>

                  <Button
                    onClick={() => handleUseVoice(voice)}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white py-2.5 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    <Wand2 className="w-4 h-4" />
                    {t('useVoice')}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-24">
              <Globe className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">
                {t('comingSoon')}
              </h3>
              <p className="text-gray-500 max-w-md mx-auto">
                {t('comingSoonDesc', { language: selectedLangObj?.name || '' })}
              </p>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </main>
  );
}
