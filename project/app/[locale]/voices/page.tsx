'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { languages, getVoicesForLanguage, findLanguageByVoiceName, Voice, voicesByLanguage } from '@/lib/voices';
import { User, UserRound, Play, Pause, Activity, Wand2, ChevronDown, X, Globe, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import Footer from '@/components/landing/Footer';
import BrowseVoiceTabs from '@/components/BrowseVoiceTabs';
import { audioManager } from '@/lib/audioManager';

const POPULAR_CODES = ['en', 'zh-CN', 'zh-TW', 'yue', 'ja', 'ko', 'th', 'es', 'fr'];
const popularLanguages = languages.filter(l => POPULAR_CODES.includes(l.code));
const moreLanguages = languages.filter(l => !POPULAR_CODES.includes(l.code));

const LANG_CODE_MAP: Record<string, string> = {
  'english': 'en',
  'mandarin (simplified)': 'zh-CN', 'mandarin simplified': 'zh-CN', 'zh-cn': 'zh-CN', '普通話': 'zh-CN', '简体': 'zh-CN', '简中': 'zh-CN',
  'mandarin (traditional)': 'zh-TW', 'mandarin traditional': 'zh-TW', 'zh-tw': 'zh-TW', '台灣繁體': 'zh-TW', '繁體': 'zh-TW', '台繁': 'zh-TW',
  'mandarin': 'zh-TW', 'mandarin chinese': 'zh-TW', 'chinese': 'zh-TW', 'chinese (mandarin)': 'zh-TW',
  'cantonese': 'yue', 'chinese (cantonese)': 'yue',
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

function pickLocalizedBio(bio: string | null | undefined, locale: string): string {
  if (!bio) return '';
  // bio may be plain string OR JSON {en, zh-TW, zh-CN}
  const trimmed = bio.trim();
  if (!trimmed.startsWith('{')) return bio; // plain string
  try {
    const parsed = JSON.parse(trimmed) as Record<string, string>;
    return parsed[locale] || parsed['en'] || Object.values(parsed)[0] || '';
  } catch {
    return bio;
  }
}

function talentToVoice(talent: any, locale: string = 'en'): Voice & { langCodes: string[] } {
  const langCodes: string[] = (talent.languages || []).map((lang: string) => resolveLangCode(lang));
  const demos = (talent.demo_urls || []) as Array<{ name?: string; url: string; label?: string }>;
  const bio = pickLocalizedBio(talent.bio, locale);

  return {
    id: `db_${talent.id}`,
    name: talent.name,
    gender: (talent.gender || 'male').toLowerCase() as 'male' | 'female',
    description: bio || talent.tags?.join(', ') || 'Professional voice talent',
    audioPreviewUrl: talent.sample_url || demos[0]?.url || '',
    demos,
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
  // Per-voice: which demo chip the user has clicked (= which language
  // demo the main ▶ should play). null/undefined = use voice.audioPreviewUrl.
  // Decoupled from playingVoiceId so chip click ≠ play (Wing 2026-06-07
  // bug report: chip 點下去就自動播放是錯的;chip 只該 SELECT,▶ 才該 PLAY).
  const [selectedDemoIndexByVoice, setSelectedDemoIndexByVoice] = useState<Record<string, number>>({});
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
        const baseV = talentToVoice(t, locale);
        const demoUrls: Array<{ name?: string; url: string; label?: string }> = t.demo_urls || [];
        for (const code of baseV.langCodes) {
          if (!mapped[code]) mapped[code] = [];
          // 每種語言找對應的 demo (by label),用該 demo 當 preview;沒對應就 fallback baseV.audioPreviewUrl
          const matching = demoUrls.find((d) => d.label === code);
          const langSpecificV: Voice & { langCodes: string[] } = matching?.url
            ? { ...baseV, audioPreviewUrl: matching.url }
            : baseV;
          mapped[code].push(langSpecificV);
        }
        if (baseV.langCodes.length === 0) {
          if (!mapped['en']) mapped['en'] = [];
          mapped['en'].push(baseV);
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

  // Tear down audio when the page unmounts (navigation away). The
  // local ref handles the page-owned <audio>; audioManager.stopAll()
  // also catches anything kicked off by other components (e.g. the
  // homepage FeaturedVoices) that's still tracked globally.
  useEffect(() => {
    return () => {
      stopCurrentAudio();
      audioManager.stopAll();
    };
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
      <div className="relative pt-20 pb-28 px-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.05),transparent_50%)]" />

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              {t('pageTitle')}
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              {t('pageSubtitle')}
            </p>
            <div className="mt-8 flex justify-center">
              <BrowseVoiceTabs />
            </div>
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
                  {'zhName' in selectedLangObj ? langDisplayName(selectedLangObj as typeof languages[number]) : selectedLangObj.name}
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
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {availableVoices.map((voice: Voice) => {
                const selectedIdx = selectedDemoIndexByVoice[voice.id];
                const isPlaying = playingVoiceId === voice.id;
                return (
                  <div
                    key={voice.id}
                    className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3 hover:border-zinc-600 transition-colors flex flex-col gap-2 min-h-[180px]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative flex-none">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/30 to-zinc-700 flex items-center justify-center text-blue-200">
                          {voice.gender === 'female' ? <UserRound className="w-6 h-6" /> : <User className="w-6 h-6" />}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            const selectedDemo = selectedIdx != null ? voice.demos?.[selectedIdx] : null;
                            const url = selectedDemo?.url || voice.audioPreviewUrl;
                            toggleAudioPreview({ ...voice, audioPreviewUrl: url }, e);
                          }}
                          aria-label={isPlaying ? t('stopPreview') : t('playPreview')}
                          className="absolute -right-1 -bottom-1 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-400"
                        >
                          {isPlaying ? <Activity className="w-3 h-3 animate-pulse" /> : <Play className="w-3 h-3 ml-0.5" />}
                        </button>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white truncate">{voice.name}</h3>
                        <p className="text-[11px] text-gray-500">{genderLabel(voice.gender)}</p>
                      </div>
                    </div>

                    {voice.demos && voice.demos.length > 1 && (
                      <div className="flex flex-wrap gap-1">
                        {voice.demos.map((demo, i) => {
                          const langObj = languages.find(l => l.code === demo.label);
                          const display = langObj ? langDisplayName(langObj) : (demo.label || `Demo ${i + 1}`);
                          const isSelected = selectedIdx === i;
                          return (
                            <button
                              key={demo.url + i}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                stopCurrentAudio();
                                setSelectedDemoIndexByVoice(prev => ({ ...prev, [voice.id]: i }));
                              }}
                              className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                                isSelected
                                  ? 'bg-blue-500/20 text-blue-200 border-blue-400/40'
                                  : 'bg-zinc-800 border-zinc-700 text-gray-300 hover:border-zinc-500'
                              }`}
                              title={demo.name || display}
                            >
                              {display}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <Button
                      onClick={() => handleUseVoice(voice)}
                      className="mt-auto w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2"
                    >
                      <Wand2 className="w-4 h-4" />
                      {t('useVoice')}
                    </Button>
                  </div>
                );
              })}
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

      {/* persistent now-playing bar — mirrors the human roster */}
      {playingVoiceId && (() => {
        const v = allVoices.find((x) => x.id === playingVoiceId);
        if (!v) return null;
        return (
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/95 backdrop-blur border-t border-zinc-800">
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
              <button
                onClick={stopCurrentAudio}
                aria-label={t('stopPreview')}
                className="w-9 h-9 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-400 flex-none"
              >
                <Pause className="w-4 h-4" />
              </button>
              <div className="min-w-0 w-40 flex-none">
                <p className="text-sm font-medium text-white truncate">{v.name}</p>
                <p className="text-[11px] text-gray-400 truncate">{genderLabel(v.gender)}</p>
              </div>
              <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-blue-400 rounded-full transition-[width] duration-200" style={{ width: `${audioProgress}%` }} />
              </div>
            </div>
          </div>
        );
      })()}

      <Footer />
    </main>
  );
}
