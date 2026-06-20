'use client';

/*
  Phase 1 — public talent profile page. Reads the public-safe single-talent
  record from /api/talents/roster?id=. CTA leads to enquiry (manual matchmaking
  for the MVP; Phase 2 will replace it with a real brief/quote flow).
*/

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import CatalogAudioPlayer from '@/components/catalog/CatalogAudioPlayer';

interface Talent {
  id: string;
  name: string;
  languages?: string[];
  tags?: string[];
  gender?: string;
  accent?: string;
  demo_urls?: { name?: string; url: string; label?: string }[];
  sample_url?: string;
  headshot_url?: string;
  bio?: string | Record<string, string>;
}

const initial = (s: string) => (s || '?').trim().charAt(0).toUpperCase();

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

  // bio may be a plain string, a JSON-encoded {en,zh-TW,zh-CN} string, or an object
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
    return obj[locale] || obj['en'] || Object.values(obj)[0] || '';
  })();

  const demos = t?.demo_urls?.length ? t.demo_urls : t?.sample_url ? [{ url: t.sample_url }] : [];
  const genderLabel = (g?: string) => {
    const v = (g || '').toLowerCase();
    return v === 'male' ? tx('男聲', '男声', 'Male') : v === 'female' ? tx('女聲', '女声', 'Female') : g ? tx('其他', '其他', 'Other') : '';
  };

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
            <div className="flex items-center gap-4 mb-6">
              {t.headshot_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.headshot_url} alt={t.name} className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/30 to-zinc-700 flex items-center justify-center text-2xl font-semibold text-amber-200">{initial(t.name)}</div>
              )}
              <div>
                <h1 className="text-2xl font-bold">{t.name}</h1>
                <p className="text-sm text-gray-400">{[genderLabel(t.gender), t.accent].filter(Boolean).join(' · ')}</p>
              </div>
            </div>

            {(t.languages || []).length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1.5">{tx('可配語言與口音', '可配语言与口音', 'Languages & accents')}</p>
                <div className="flex flex-wrap gap-1.5">{(t.languages || []).map((l) => <span key={l} className="text-xs px-2.5 py-1 rounded bg-zinc-800 text-gray-200">{l}</span>)}</div>
              </div>
            )}
            {(t.tags || []).length > 0 && (
              <div className="mb-6">
                <p className="text-xs text-gray-500 mb-1.5">{tx('聲線 / 專長', '声线 / 专长', 'Voice & specialties')}</p>
                <div className="flex flex-wrap gap-1.5">{(t.tags || []).map((g) => <span key={g} className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300/90">{g}</span>)}</div>
              </div>
            )}

            {bioText && <p className="text-sm text-gray-300 leading-relaxed mb-6 whitespace-pre-line">{bioText}</p>}

            {demos.length > 0 && (
              <div className="mb-8">
                <p className="text-xs text-gray-500 mb-2">{tx('試聽 demo', '试听 demo', 'Demos')}</p>
                <div className="space-y-2">
                  {demos.map((d, i) => (
                    <div key={i} className="flex items-center gap-3 bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                      <div className="scale-90"><CatalogAudioPlayer audioUrl={d.url} /></div>
                      <span className="text-sm text-gray-300">{d.name || d.label || `${tx('試聽', '试听', 'Demo')} ${i + 1}`}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Link href={`/${locale}/contact?talent=${encodeURIComponent(t.name)}`}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500 text-black font-medium hover:bg-amber-400 transition-colors">
              <MessageSquare className="w-4 h-4" /> {tx('洽詢這位配音', '洽询这位配音', 'Enquire about this talent')}
            </Link>
            <p className="text-xs text-gray-500 mt-3">{tx('告訴我們您的需求,我們會協助安排與報價。', '告诉我们您的需求,我们会协助安排与报价。', 'Tell us about your project and we’ll help arrange and quote it.')}</p>
          </>
        )}
      </div>
    </main>
  );
}
