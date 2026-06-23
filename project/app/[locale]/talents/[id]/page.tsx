'use client';

/*
  Public talent profile page. Reads the admin-approved published_snapshot via
  /api/talents/roster?id=. Voice traits / specialties / demo categories are stored
  as canonical keys and localized here from the shared taxonomy. Demos are grouped
  by category; bio is multilingual (string or {locale:text}). CTA leads to enquiry.
*/

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ArrowLeft, MessageSquare, MapPin, Mic2 } from 'lucide-react';
import { traitLabel, useCaseLabel, USE_CASES, formatLangEntry, countryLabel, availabilityLabel, voiceAgeLabel, type DemoItem } from '@/lib/talent-taxonomy';
import { cjkSpace } from '@/lib/cjk-space';
import { pickLocale } from '@/lib/i18n-pick';

interface Talent {
  id: string;
  name: string;
  languages?: string[];
  tags?: string[];
  voice_traits?: string[];
  specialties?: string[];
  voice_ages?: string[];
  gender?: string;
  accent?: string;
  demos?: DemoItem[];
  demo_urls?: { name?: string; url: string; label?: string }[];
  sample_url?: string;
  headshot_url?: string;
  bio?: string | Record<string, string>;
  location?: string;
  availability_note?: string;
  credits?: string;
  clients?: string | Record<string, string>;
  awards?: string | Record<string, string>;
  notable_works?: string | Record<string, string>;
  special_skills?: string | Record<string, string>;
  equipment?: string;
  studio_partner?: string;
}

const initial = (s: string) => (s || '?').trim().charAt(0).toUpperCase();

const SERVICE: Record<string, { tw: string; cn: string; en: string }> = {
  'AI Voice': { tw: 'AI 聲音', cn: 'AI 声音', en: 'AI Voice' },
  'TTS Data': { tw: 'TTS 訓練', cn: 'TTS 训练', en: 'TTS Data' },
  'Proofreading': { tw: '語音校對', cn: '语音校对', en: 'Proofreading' },
};

export default function TalentProfile() {
  const locale = useLocale();
  const isZh = locale.startsWith('zh');
  const isZhCN = locale === 'zh-CN';
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);
  const { id } = useParams<{ id: string }>();

  const [t, setT] = useState<Talent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/talents/roster?id=${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setT(d))
      .catch(() => setT(null))
      .finally(() => setLoading(false));
  }, [id]);

  const bioText = (() => {
    if (!t?.bio) return '';
    let obj: Record<string, string>;
    if (typeof t.bio === 'string') {
      const s = t.bio.trim();
      if (!s.startsWith('{')) return t.bio;
      try { obj = JSON.parse(s) as Record<string, string>; } catch { return t.bio; }
    } else {
      obj = t.bio as Record<string, string>;
    }
    // Fallback order: Chinese viewers prefer the other Chinese variant before
    // English (never show English to a zh viewer just because one variant is
    // blank); English viewers prefer Chinese only if there's no English.
    const order = locale === 'en' ? ['en', 'zh-TW', 'zh-CN'] : locale === 'zh-CN' ? ['zh-CN', 'zh-TW', 'en'] : ['zh-TW', 'zh-CN', 'en'];
    for (const k of order) if (obj[k]) return obj[k];
    return Object.values(obj)[0] || '';
  })();

  // Categorized demos take precedence; fall back to legacy flat demos.
  const categorized = Array.isArray(t?.demos) && t!.demos!.length > 0 ? t!.demos! : [];
  const flatDemos = !categorized.length
    ? (t?.demo_urls?.length ? t.demo_urls : t?.sample_url ? [{ url: t.sample_url }] : [])
    : [];
  const demosByCat = USE_CASES.map((c) => ({ c, items: categorized.filter((d) => d.category === c.key) })).filter((g) => g.items.length > 0);

  const genderLabel = (g?: string) => {
    const v = (g || '').toLowerCase();
    return v === 'male' ? tx('男聲', '男声', 'Male') : v === 'female' ? tx('女聲', '女声', 'Female') : g ? tx('其他', '其他', 'Other') : '';
  };
  const ageLabel = (t?.voice_ages || []).map((a) => voiceAgeLabel(a, locale)).join(' / ');
  const metaLine = [genderLabel(t?.gender), ageLabel, t?.location ? countryLabel(t.location, locale) : ''].filter(Boolean).join(' · ');
  const availabilityKeys = (t?.availability_note || '').split(',').map((s) => s.trim()).filter(Boolean);
  // Credit fields may be plain strings (legacy) or {locale:text} (auto-translated).
  const clientsT = cjkSpace(pickLocale(t?.clients, locale));
  const notableT = cjkSpace(pickLocale(t?.notable_works, locale));
  const awardsT = cjkSpace(pickLocale(t?.awards, locale));
  const skillsT = cjkSpace(pickLocale(t?.special_skills, locale));

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-3xl mx-auto px-4 pt-28 pb-16">
        <Link href={`/${locale}/talents`} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4" /> {tx('返回配音陣容', '返回配音阵容', 'Back to roster')}
        </Link>

        {loading ? (
          <p className="text-gray-500 text-sm">{tx('載入中…', '加载中…', 'Loading…')}</p>
        ) : !t ? (
          <p className="text-gray-400">{tx('找不到這位配音員。', '找不到这位配音员。', 'Talent not found.')}</p>
        ) : (
          <>
            <div className="flex items-center gap-5 mb-7">
              {t.headshot_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.headshot_url} alt={t.name} className="w-28 h-28 rounded-2xl object-cover" />
              ) : (
                <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-amber-500/30 to-zinc-700 flex items-center justify-center text-3xl font-semibold text-amber-200">{initial(t.name)}</div>
              )}
              <div>
                <h1 className="text-2xl font-bold">{t.name}</h1>
                {metaLine && <p className="text-sm text-gray-400 mt-1 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 opacity-60" />{metaLine}</p>}
              </div>
            </div>

            {(t.languages || []).length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1.5">{tx('可配語言與口音', '可配语言与口音', 'Languages & accents')}</p>
                <div className="flex flex-wrap gap-1.5">{(t.languages || []).map((l) => <span key={l} className="text-xs px-2.5 py-1 rounded bg-zinc-800 text-gray-200">{formatLangEntry(l, locale)}</span>)}</div>
              </div>
            )}

            {(t.voice_traits || []).length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1.5">{tx('聲線特質', '声线特质', 'Voice traits')}</p>
                <div className="flex flex-wrap gap-1.5">{(t.voice_traits || []).map((k) => <span key={k} className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300/90">{traitLabel(k, locale)}</span>)}</div>
              </div>
            )}

            {(t.specialties || []).length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1.5">{tx('專長類型', '专长类型', 'Specialties')}</p>
                <div className="flex flex-wrap gap-1.5">{(t.specialties || []).map((k) => <span key={k} className="text-xs px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-300/90">{useCaseLabel(k, locale)}</span>)}</div>
              </div>
            )}

            {(() => {
              const svc = (t.tags || []).filter((g) => SERVICE[g]);
              if (!svc.length) return null;
              return (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-1.5">{tx('可提供的服務', '可提供的服务', 'Services offered')}</p>
                  <div className="flex flex-wrap gap-1.5">{svc.map((g) => <span key={g} className="text-xs px-2.5 py-1 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">{tx(SERVICE[g].tw, SERVICE[g].cn, SERVICE[g].en)}</span>)}</div>
                </div>
              );
            })()}

            {skillsT && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1.5">{tx('特殊技能 / 模仿', '特殊技能 / 模仿', 'Special skills & impressions')}</p>
                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{skillsT}</p>
              </div>
            )}

            {bioText && <p className="text-sm text-gray-300 leading-relaxed mb-6 mt-2 whitespace-pre-line">{cjkSpace(bioText)}</p>}

            {(clientsT || awardsT || notableT || t.credits) && (
              <div className="mb-5 space-y-3">
                {clientsT && (<div><p className="text-xs text-gray-500 mb-1">{tx('合作品牌 / 客戶', '合作品牌 / 客户', 'Clients & brands')}</p><p className="text-sm text-gray-300 leading-relaxed">{clientsT}</p></div>)}
                {notableT && (<div><p className="text-xs text-gray-500 mb-1">{tx('代表作', '代表作', 'Notable work')}</p><p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{notableT}</p></div>)}
                {awardsT && (<div><p className="text-xs text-gray-500 mb-1">{tx('獎項', '奖项', 'Awards')}</p><p className="text-sm text-gray-300 leading-relaxed">{awardsT}</p></div>)}
                {!clientsT && !awardsT && !notableT && t.credits && (<div><p className="text-xs text-gray-500 mb-1">{tx('合作單位 / 經歷', '合作单位 / 经历', 'Clients & experience')}</p><p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{cjkSpace(typeof t.credits === 'string' ? t.credits : '')}</p></div>)}
              </div>
            )}

            {availabilityKeys.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1.5">{tx('可工作時段', '可工作时段', 'Availability')}</p>
                <div className="flex flex-wrap gap-1.5">{availabilityKeys.map((k) => <span key={k} className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-gray-300">{availabilityLabel(k, locale)}</span>)}</div>
              </div>
            )}

            {/* studio_partner (錄音室) is internal-only — never shown to clients. */}
            {t.equipment && (
              <div className="mb-7 grid gap-2 text-sm text-gray-400">
                <p className="flex items-start gap-2"><Mic2 className="w-4 h-4 mt-0.5 opacity-60 shrink-0" /><span>{cjkSpace(pickLocale(t.equipment, locale))}</span></p>
              </div>
            )}

            {/* Categorized demos */}
            {demosByCat.length > 0 && (
              <div className="mb-8 space-y-5">
                {demosByCat.map(({ c, items }) => (
                  <div key={c.key}>
                    <p className="text-xs text-gray-500 mb-2">{useCaseLabel(c.key, locale)}</p>
                    <div className="space-y-2">
                      {items.map((d, i) => (
                        <div key={d.url || i} className="flex items-center gap-3 bg-zinc-900/50 rounded-lg px-3 py-2">
                          <span className="text-sm text-gray-200 w-36 sm:w-44 truncate shrink-0">{cjkSpace(pickLocale(d.name, locale)) || `${useCaseLabel(c.key, locale)} ${i + 1}`}</span>
                          <audio controls src={d.url} className="h-8 flex-1 min-w-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Legacy flat demos fallback */}
            {flatDemos.length > 0 && (
              <div className="mb-8">
                <p className="text-xs text-gray-500 mb-2">{tx('試聽 demo', '试听 demo', 'Demos')}</p>
                <div className="space-y-2">
                  {flatDemos.map((d, i) => (
                    <div key={i} className="flex items-center gap-3 bg-zinc-900/50 rounded-lg px-3 py-2">
                      <span className="text-sm text-gray-200 w-36 sm:w-44 truncate shrink-0">{('name' in d && d.name) || ('label' in d && d.label) || `${tx('試聽', '试听', 'Demo')} ${i + 1}`}</span>
                      <audio controls src={d.url} className="h-8 flex-1 min-w-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Link href={`/${locale}/hire?talent=${encodeURIComponent(t.name)}&talentId=${t.id}`}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-medium transition-colors">
              <MessageSquare className="w-4 h-4" /> {tx('洽詢配音', '洽询配音', 'Enquire about this talent')}
            </Link>
            <p className="text-xs text-gray-500 mt-3">{tx('告訴我們您的需求,我們會協助安排與報價。', '告诉我们您的需求,我们会协助安排与报价。', 'Tell us about your project and we’ll help arrange and quote it.')}</p>
          </>
        )}
      </div>
    </main>
  );
}
