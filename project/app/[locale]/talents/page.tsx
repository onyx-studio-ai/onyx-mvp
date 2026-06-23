'use client';

/*
  Phase 1 — public human-talent roster (hiring marketplace gallery).
  Browse approved (is_active) voice talents, hear a demo, filter by language /
  gender, then enquire. Distinct from /voices (the AI-voice catalogue).
  Tri-lingual via useLocale()+tx(). Reads the public-safe /api/talents/roster.
*/

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Search, ArrowRight } from 'lucide-react';
import CatalogAudioPlayer from '@/components/catalog/CatalogAudioPlayer';
import BrowseVoiceTabs from '@/components/BrowseVoiceTabs';

interface Talent {
  id: string;
  name: string;
  type: string;
  languages?: string[];
  tags?: string[];
  gender?: string;
  accent?: string;
  demos?: { category?: string; name?: string; url: string }[];
  demo_urls?: { name?: string; url: string; label?: string }[];
  sample_url?: string;
  headshot_url?: string;
  bio?: string;
}

// Card preview = the talent's own managed demos (first = their primary). Legacy
// application demo (demo_urls/sample_url) is only a fallback when they have none,
// so a stale application clip never plays a demo they can't see or remove.
const demoUrl = (t: Talent) => t.demos?.[0]?.url || t.demo_urls?.[0]?.url || t.sample_url || '';
const initial = (s: string) => (s || '?').trim().charAt(0).toUpperCase();

// Service-classification tags (set on approval from collaboration choices).
const SERVICE: Record<string, { tw: string; cn: string; en: string }> = {
  'AI Voice': { tw: 'AI 聲音', cn: 'AI 声音', en: 'AI Voice' },
  'TTS Data': { tw: 'TTS 訓練', cn: 'TTS 训练', en: 'TTS Data' },
  'Proofreading': { tw: '語音校對', cn: '语音校对', en: 'Proofreading' },
};

export default function TalentRoster() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);

  const [talents, setTalents] = useState<Talent[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [lang, setLang] = useState('');
  const [gender, setGender] = useState('');

  useEffect(() => {
    fetch('/api/talents/roster')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setTalents(Array.isArray(d) ? d : []))
      .catch(() => setTalents([]))
      .finally(() => setLoading(false));
  }, []);

  const languages = useMemo(() => {
    const set = new Set<string>();
    talents.forEach((t) => (t.languages || []).forEach((l) => set.add(l)));
    return [...set].sort();
  }, [talents]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return talents.filter((t) => {
      if (lang && !(t.languages || []).includes(lang)) return false;
      if (gender && (t.gender || '').toLowerCase() !== gender) return false;
      if (term) {
        const hay = [t.name, ...(t.languages || []), ...(t.tags || []), t.accent].join(' ').toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [talents, q, lang, gender]);

  const genderLabel = (g?: string) => {
    const v = (g || '').toLowerCase();
    return v === 'male' ? tx('男聲', '男声', 'Male') : v === 'female' ? tx('女聲', '女声', 'Female') : g ? tx('其他', '其他', 'Other') : '';
  };

  const selectCls = 'px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm focus:border-amber-500 focus:outline-none';

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-6xl mx-auto px-4 pt-28 pb-16">
        {/* Centered hero mirrors /voices so toggling AI <-> Human doesn't jump. */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">{tx('瀏覽聲音', '浏览声音', 'Browse Voices')}</h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">{tx('試聽真人配音員,依語言與聲線挑選,找到適合的聲音即可洽詢合作。', '试听真人配音员,依语言与声线挑选,找到适合的声音即可洽询合作。', 'Listen to our real human voice talents, filter by language and voice, and get in touch when you find the right one.')}</p>
          <div className="mt-8 flex justify-center"><BrowseVoiceTabs /></div>
        </div>

        {/* filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx('搜尋名稱、語言、聲線…', '搜寻名称、语言、声线…', 'Search name, language, voice…')}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm focus:border-amber-500 focus:outline-none placeholder:text-gray-600" />
          </div>
          <select className={selectCls} value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="">{tx('所有語言', '所有语言', 'All languages')}</option>
            {languages.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <select className={selectCls} value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">{tx('不限性別', '不限性别', 'Any gender')}</option>
            <option value="male">{tx('男聲', '男声', 'Male')}</option>
            <option value="female">{tx('女聲', '女声', 'Female')}</option>
          </select>
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">{tx('載入中…', '加载中…', 'Loading…')}</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 border border-zinc-800 rounded-2xl">
            <p className="text-gray-300">{talents.length === 0 ? tx('配音員陸續加入中,敬請期待。', '配音员陆续加入中,敬请期待。', 'Voice talents are joining — check back soon.') : tx('找不到符合條件的配音員。', '找不到符合条件的配音员。', 'No talents match your filters.')}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((t) => {
              const url = demoUrl(t);
              return (
                <div key={t.id} className="group bg-zinc-950 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-600 transition-all flex flex-col">
                  <div className="flex items-center gap-3 mb-3">
                    {t.headshot_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.headshot_url} alt={t.name} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500/30 to-zinc-700 flex items-center justify-center text-lg font-semibold text-amber-200">{initial(t.name)}</div>
                    )}
                    <div className="min-w-0">
                      <Link href={`/${locale}/talents/${t.id}`} className="font-semibold text-white hover:text-amber-300 truncate block">{t.name}</Link>
                      <p className="text-xs text-gray-500">{[genderLabel(t.gender), t.accent].filter(Boolean).join(' · ')}</p>
                    </div>
                    {url && <div className="ml-auto scale-90"><CatalogAudioPlayer audioUrl={url} /></div>}
                  </div>

                  {(t.languages || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(t.languages || []).slice(0, 4).map((l) => <span key={l} className="text-[11px] px-2 py-0.5 rounded bg-zinc-800 text-gray-300">{l}</span>)}
                    </div>
                  )}
                  {(() => {
                    const svc = (t.tags || []).filter((g) => SERVICE[g]);
                    const voice = (t.tags || []).filter((g) => !SERVICE[g]);
                    return (
                      <>
                        {svc.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {svc.map((g) => <span key={g} className="text-[11px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">{tx(SERVICE[g].tw, SERVICE[g].cn, SERVICE[g].en)}</span>)}
                          </div>
                        )}
                        {voice.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {voice.slice(0, 5).map((g) => <span key={g} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300/90">{g}</span>)}
                          </div>
                        )}
                      </>
                    );
                  })()}

                  <Link href={`/${locale}/talents/${t.id}`} className="mt-auto inline-flex items-center gap-1 text-sm text-amber-300 hover:text-amber-200">
                    {tx('查看 / 洽詢', '查看 / 洽询', 'View / enquire')} <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
