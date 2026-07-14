'use client';

/*
  Public human-talent roster (hiring marketplace gallery) — ElevenLabs-style
  discovery: faceted filters + language quick-chips with live counts + a uniform
  card grid where every card is the SAME height (overflow tags collapse to "+N"),
  with inline preview that feeds a persistent bottom now-playing bar (Spotify's
  one genuinely-relevant lesson). Built so it reads cleanly at 1 talent or 1000.

  Distinct from /voices (the AI-voice catalogue). Tri-lingual via useLocale()+tx().
  Reads the public-safe /api/talents/roster (the admin-approved snapshot only).
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Search, ArrowRight, Play, Pause } from 'lucide-react';
import FavoriteButton from '@/components/marketplace/FavoriteButton';
import BrowseVoiceTabs from '@/components/BrowseVoiceTabs';
import { Waveform, WaveStyle } from '@/components/Waveform';
import {
  formatLangEntry, baseLangLabel, canonicalLangKey, accentKeyOf, accentLabel, traitLabel, useCaseLabel, voiceAgeLabel, countryLabel,
  VOICE_TRAITS, USE_CASES, VOICE_AGES, TRAIT_KEYS,
} from '@/lib/talent-taxonomy';
import { pickLocale } from '@/lib/i18n-pick';

interface Demo { category?: string; name?: string; url: string; language?: string }
interface Talent {
  id: string;
  name: string;
  name_i18n?: Record<string, string>;
  years_experience?: number;
  type?: string;
  languages?: string[];
  voice_traits?: string[];
  specialties?: string[];
  voice_ages?: string[];
  tag_i18n?: Record<string, Record<string, string>>;
  tags?: string[];
  gender?: string;
  accent?: string;
  location?: string;
  demos?: Demo[];
  demo_urls?: { name?: string; url: string }[];
  sample_url?: string;
  headshot_url?: string;
}

const initial = (s: string) => (s || '?').trim().charAt(0).toUpperCase();
// Canonical language key — collapses synonyms/variants ("中文(國語)" / "國語" /
// "Chinese · Taiwan" → mandarin) so the filter chips don't fragment.
const langBase = (v: string) => canonicalLangKey(v);

// Services a real talent ACCEPTS (distinct from 用途/demo categories). Stored in
// talents.tags as canonical English on approval (from the application coop_* opt-ins),
// so a client can filter for, e.g., who's open to TTS-data or proofreading work.
const SERVICE_LABEL: Record<string, { tw: string; cn: string; en: string }> = {
  'AI Voice':       { tw: 'AI 聲音',  cn: 'AI 声音',  en: 'AI Voice' },
  'TTS Data':       { tw: 'TTS 訓練', cn: 'TTS 训练', en: 'TTS Data' },
  'Proofreading':   { tw: '語音校對', cn: '语音校对', en: 'Proofreading' },
  'Voice Director': { tw: '聲音導演', cn: '声音导演', en: 'Voice Director' },
};
const SERVICE_KEYS = Object.keys(SERVICE_LABEL);
const servicesOf = (tags?: string[]) => (tags || []).filter((g) => SERVICE_KEYS.includes(g));
const fmtTime = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${r < 10 ? '0' : ''}${r}`;
};

export default function TalentRoster() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  const [talents, setTalents] = useState<Talent[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [lang, setLang] = useState('');      // base language key, '' = all
  const [accent, setAccent] = useState('');  // accent key within the chosen language, '' = all accents
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [trait, setTrait] = useState('');
  const [useCase, setUseCase] = useState('');
  const [service, setService] = useState('');   // accepted service type (TTS / proofreading / …)

  // --- persistent now-playing player (single audio element) ---
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [now, setNow] = useState<{ id: string; name: string; label: string } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);

  // Locale-aware display name (English page uses the self-provided English name).
  const nameOf = (t: Talent) => pickLocale(t.name_i18n, locale) || t.name;

  useEffect(() => {
    fetch('/api/talents/roster')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setTalents(Array.isArray(d) ? d : []))
      .catch(() => setTalents([]))
      .finally(() => setLoading(false));
  }, []);

  const genderLabel = (g?: string) => {
    const v = (g || '').toLowerCase();
    return v === 'male' ? tx('男聲', '男声', 'Male') : v === 'female' ? tx('女聲', '女声', 'Female') : g ? tx('其他', '其他', 'Other') : '';
  };

  // Primary demo = the talent's first managed demo (they order it; ★ = first).
  // Legacy application clip only as a fallback so nothing they can't see plays.
  const primaryDemo = (t: Talent): { url: string; label: string } | null => {
    const d = (t.demos || []).find((x) => x?.url);
    if (d) {
      const label = d.category ? useCaseLabel(d.category, locale) : (pickLocale(d.name, locale) || tx('試聽', '试听', 'Demo'));
      return { url: d.url, label };
    }
    const leg = t.demo_urls?.find((x) => x?.url)?.url || t.sample_url;
    return leg ? { url: leg, label: tx('試聽', '试听', 'Demo') } : null;
  };

  // Language quick-chips: counts over ALL talents (stable), top by frequency.
  const langCounts = useMemo(() => {
    const m = new Map<string, number>();
    talents.forEach((t) => {
      const seen = new Set<string>();
      (t.languages || []).forEach((l) => {
        const k = langBase(l);
        if (k && !seen.has(k)) { seen.add(k); m.set(k, (m.get(k) || 0) + 1); }
      });
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [talents]);
  const topLangs = langCounts.slice(0, 6);

  // Accent options WITHIN the chosen language (台灣 / 大陸 …) with live counts —
  // so "國語" can be narrowed to 台灣腔 vs 大陸腔 instead of lumping them together.
  const accentCounts = useMemo(() => {
    if (!lang) return [] as [string, number][];
    const m = new Map<string, number>();
    talents.forEach((t) => {
      const seen = new Set<string>();
      (t.languages || []).forEach((l) => {
        if (langBase(l) !== lang) return;
        const a = accentKeyOf(l);
        if (a && !seen.has(a)) { seen.add(a); m.set(a, (m.get(a) || 0) + 1); }
      });
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [talents, lang]);

  // Service types actually present in the roster (preserve canonical order).
  const presentServices = useMemo(() => {
    const set = new Set<string>();
    talents.forEach((t) => servicesOf(t.tags).forEach((s) => set.add(s)));
    return SERVICE_KEYS.filter((k) => set.has(k));
  }, [talents]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return talents.filter((t) => {
      if (lang && !(t.languages || []).some((l) => langBase(l) === lang && (!accent || accentKeyOf(l) === accent))) return false;
      if (gender && (t.gender || '').toLowerCase() !== gender) return false;
      if (age && !(t.voice_ages || []).includes(age)) return false;
      if (trait && !(t.voice_traits || []).includes(trait)) return false;
      if (useCase && !(t.specialties || []).includes(useCase) && !(t.demos || []).some((d) => d.category === useCase)) return false;
      if (service && !servicesOf(t.tags).includes(service)) return false;
      if (term) {
        const hay = [
          t.name, t.accent, t.location ? countryLabel(t.location, locale) : '',
          ...(t.languages || []).map((l) => formatLangEntry(l, locale)),
          ...(t.voice_traits || []).map((k) => traitLabel(k, locale)),
          ...(t.specialties || []).map((k) => useCaseLabel(k, locale)),
          ...servicesOf(t.tags).map((k) => SERVICE_LABEL[k] ? (isZhCN ? SERVICE_LABEL[k].cn : isZh ? SERVICE_LABEL[k].tw : SERVICE_LABEL[k].en) : k),
        ].join(' ').toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [talents, q, lang, accent, gender, age, trait, useCase, service, locale, isZh, isZhCN]);

  const togglePlay = (t: Talent) => {
    const pd = primaryDemo(t);
    const a = audioRef.current;
    if (!pd || !a) return;
    if (now?.id === t.id) { if (a.paused) a.play().catch(() => {}); else a.pause(); return; }
    setNow({ id: t.id, name: nameOf(t), label: pd.label });
    a.src = pd.url;
    a.currentTime = 0;
    a.play().catch(() => {});
  };

  const selectCls = 'px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm focus:border-blue-500 focus:outline-none';
  const pill = 'text-[11px] px-2 py-0.5 rounded-full';

  // Render up to `max` localized items as pills, with a "+N" overflow pill.
  const pills = (items: string[], label: (k: string) => string, cls: string, max = 3) => {
    const shown = items.slice(0, max);
    const extra = items.length - shown.length;
    return (
      <div className="flex flex-wrap gap-1">
        {shown.map((k) => <span key={k} className={`${pill} ${cls}`}>{label(k)}</span>)}
        {extra > 0 && <span className={`${pill} bg-zinc-800 text-gray-500`}>+{extra}</span>}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <WaveStyle />
      <div className="max-w-6xl mx-auto px-4 pt-28 pb-32">
        {/* Centered hero mirrors /voices so toggling AI <-> Human doesn't jump. */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">{tx('瀏覽聲音', '浏览声音', 'Browse Voices')}</h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">{tx('試聽真人配音員,依語言、聲線、用途篩選,找到適合的聲音即可洽詢合作。', '试听真人配音员,依语言、声线、用途筛选,找到适合的声音即可洽询合作。', 'Listen to our real human voice talents, filter by language, voice and use case, and get in touch when you find the right one.')}</p>
          <div className="mt-8 flex justify-center"><BrowseVoiceTabs /></div>
        </div>

        {/* filter bar */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx('搜尋名稱、語言、聲線…', '搜寻名称、语言、声线…', 'Search name, language, voice…')}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm focus:border-white/40 focus:outline-none placeholder:text-gray-600" />
          </div>
          <select className={selectCls} value={lang} onChange={(e) => { setLang(e.target.value); setAccent(''); }}>
            <option value="">{tx('所有語言', '所有语言', 'All languages')}</option>
            {langCounts.map(([k]) => <option key={k} value={k}>{baseLangLabel(k, locale)}</option>)}
          </select>
          {lang && accentCounts.length > 0 && (
            <select className={selectCls} value={accent} onChange={(e) => setAccent(e.target.value)}>
              <option value="">{tx('所有腔調', '所有腔调', 'All accents')}</option>
              {accentCounts.map(([k, n]) => <option key={k} value={k}>{accentLabel(k, locale)} ({n})</option>)}
            </select>
          )}
          <select className={selectCls} value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">{tx('不限性別', '不限性别', 'Any gender')}</option>
            <option value="male">{tx('男聲', '男声', 'Male')}</option>
            <option value="female">{tx('女聲', '女声', 'Female')}</option>
          </select>
          <select className={selectCls} value={age} onChange={(e) => setAge(e.target.value)}>
            <option value="">{tx('聲音年齡', '声音年龄', 'Voice age')}</option>
            {VOICE_AGES.map((a) => <option key={a.key} value={a.key}>{voiceAgeLabel(a.key, locale)}</option>)}
          </select>
          <select className={selectCls} value={trait} onChange={(e) => setTrait(e.target.value)}>
            <option value="">{tx('聲線', '声线', 'Voice trait')}</option>
            {VOICE_TRAITS.map((v) => <option key={v.key} value={v.key}>{traitLabel(v.key, locale)}</option>)}
          </select>
          <select className={selectCls} value={useCase} onChange={(e) => setUseCase(e.target.value)}>
            <option value="">{tx('用途', '用途', 'Use case')}</option>
            {USE_CASES.map((u) => <option key={u.key} value={u.key}>{useCaseLabel(u.key, locale)}</option>)}
          </select>
          {presentServices.length > 0 && (
            <select className={selectCls} value={service} onChange={(e) => setService(e.target.value)}>
              <option value="">{tx('可配合項目', '可配合项目', 'Services')}</option>
              {presentServices.map((k) => <option key={k} value={k}>{tx(SERVICE_LABEL[k].tw, SERVICE_LABEL[k].cn, SERVICE_LABEL[k].en)}</option>)}
            </select>
          )}
        </div>

        {/* language quick-chips with counts — the "genre" row */}
        {topLangs.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button onClick={() => { setLang(''); setAccent(''); }}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${lang === '' ? 'bg-white text-black border-white' : 'bg-zinc-900 text-gray-300 border-zinc-700 hover:border-zinc-500'}`}>
              {tx('全部', '全部', 'All')} <span className="opacity-50">{talents.length}</span>
            </button>
            {topLangs.map(([k, n]) => (
              <button key={k} onClick={() => { setLang(lang === k ? '' : k); setAccent(''); }}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${lang === k ? 'bg-white text-black border-white' : 'bg-zinc-900 text-gray-300 border-zinc-700 hover:border-zinc-500'}`}>
                {baseLangLabel(k, locale)} <span className="opacity-50">{n}</span>
              </button>
            ))}
          </div>
        )}

        {!loading && (
          <p className="text-xs text-gray-500 mb-4">{filtered.length} {tx('位配音員', '位配音员', filtered.length === 1 ? 'voice' : 'voices')}</p>
        )}

        {loading ? (
          <p className="text-gray-500 text-sm">{tx('載入中…', '加载中…', 'Loading…')}</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 border border-zinc-800 rounded-2xl">
            <p className="text-gray-300">{talents.length === 0 ? tx('配音員陸續加入中,敬請期待。', '配音员陆续加入中,敬请期待。', 'Voice talents are joining — check back soon.') : tx('找不到符合條件的配音員。', '找不到符合条件的配音员。', 'No talents match your filters.')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((t, idx) => {
              const pd = primaryDemo(t);
              const isNow = now?.id === t.id;
              const yrs = typeof t.years_experience === 'number' && t.years_experience > 0
                ? tx(`${t.years_experience} 年`, `${t.years_experience} 年`, `${t.years_experience}y`) : '';
              const meta = [genderLabel(t.gender), (t.voice_ages || []).map((a) => voiceAgeLabel(a, locale)).join('/'), t.location ? countryLabel(t.location, locale) : '', yrs]
                .filter(Boolean).join(' · ');
              return (
                <div key={t.id} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3 hover:border-zinc-600 transition-colors flex flex-col gap-2 min-h-[184px]">
                  <div className="flex items-center gap-3">
                    {t.headshot_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.headshot_url} alt={nameOf(t)} className="w-12 h-12 rounded-[14px] object-cover flex-none" />
                    ) : (
                      <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-zinc-700 to-zinc-800 flex-none flex items-center justify-center text-lg font-semibold text-gray-300">{initial(nameOf(t))}</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <Link href={`/${locale}/talents/${t.id}`} className="font-semibold text-white hover:text-amber-200 truncate block">{nameOf(t)}</Link>
                      {meta && <p className="text-[11px] text-gray-500 truncate">{meta}</p>}
                    </div>
                    <div className="self-start flex-none"><FavoriteButton talentId={t.id} size={16} /></div>
                  </div>

                  <div className="flex items-center gap-3">
                    {pd ? (
                      <button onClick={() => togglePlay(t)} aria-label={tx('播放試聽', '播放试听', 'Play demo')}
                        className="flex-none w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:bg-gray-100 shadow-md">
                        {isNow && playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                      </button>
                    ) : <span className="flex-none w-9 h-9" />}
                    <Waveform variant="human" seed={idx} active={isNow && playing} />
                  </div>

                  {(t.languages || []).length > 0 && pills(t.languages || [], (k) => formatLangEntry(k, locale), 'bg-zinc-800 text-gray-300')}
                  {servicesOf(t.tags).length > 0 && pills(servicesOf(t.tags), (k) => tx(SERVICE_LABEL[k].tw, SERVICE_LABEL[k].cn, SERVICE_LABEL[k].en), 'bg-white/5 text-gray-300 border border-white/10')}
                  {(t.voice_traits || []).length > 0 && pills(t.voice_traits || [], (k) => (TRAIT_KEYS.has(k) ? traitLabel(k, locale) : (pickLocale(t.tag_i18n?.[k], locale) || k)), 'bg-amber-500/10 text-amber-300/90')}

                  <Link href={`/${locale}/talents/${t.id}`} className="mt-auto inline-flex items-center gap-1 text-sm text-amber-300 hover:text-amber-200">
                    {tx('查看 / 洽詢', '查看 / 洽询', 'View / enquire')} <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* persistent now-playing bar */}
      <audio
        ref={audioRef}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
      />
      {now && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/95 backdrop-blur border-t border-zinc-800">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
            <button onClick={() => { const a = audioRef.current; if (!a) return; if (a.paused) a.play().catch(() => {}); else a.pause(); }}
              aria-label={playing ? tx('暫停', '暂停', 'Pause') : tx('播放', '播放', 'Play')}
              className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:bg-gray-100 flex-none">
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <div className="min-w-0 w-32 sm:w-44 flex-none">
              <p className="text-sm font-medium text-white truncate">{now.name}</p>
              <p className="text-[11px] text-gray-400 truncate">{now.label}</p>
            </div>
            <input type="range" min={0} max={dur || 0} value={cur} step={0.1}
              onChange={(e) => { const a = audioRef.current; if (a) a.currentTime = Number(e.target.value); }}
              className="flex-1 accent-amber-500 h-1" aria-label={tx('進度', '进度', 'Seek')} />
            <span className="text-[11px] text-gray-400 tabular-nums flex-none w-20 text-right">{fmtTime(cur)} / {fmtTime(dur)}</span>
          </div>
        </div>
      )}
    </main>
  );
}
