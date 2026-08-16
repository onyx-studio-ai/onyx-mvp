import { notFound } from 'next/navigation';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { pageMetadata } from '@/lib/seo';
import { voLang, voUse, VO_LANGS, VO_USES, type L3 } from '@/lib/voice-over-pages';
import DemoStrip, { type DemoStripItem } from '@/components/voice-over/DemoStrip';
import Footer from '@/components/landing/Footer';

/*
  程序化 SEO 著陸頁:/voice-over/{語言}/{用途}(server component,ISR 1hr)。
  純新增路由 —— 不動任何既有頁面;首頁/導覽都不加連結,靠 sitemap 被收錄。
  內容:語言×用途 標題與文案 + 該語言真人配音員 demo 試聽(published_snapshot,
  比照 /api/talents/roster 的過濾條件)+ 三步流程 + FAQ + /hire CTA + Service JSON-LD。
  文案只寫平台可對得到的事實(審核配音員、WAV 48kHz/24bit、發案免費、1-3 天常見交期)。
*/

export const revalidate = 3600;

export function generateStaticParams() {
  return VO_LANGS.flatMap((l) => VO_USES.map((u) => ({ lang: l.slug, use: u.slug })));
}

type Params = Promise<{ locale: string; lang: string; use: string }>;

const pick3 = (l3: L3, locale: string) => (locale === 'zh-CN' ? l3.cn : locale.startsWith('zh') ? l3.tw : l3.en);

export async function generateMetadata({ params }: { params: Params }) {
  const { locale, lang, use } = await params;
  const L = voLang(lang); const U = voUse(use);
  if (!L || !U) return {};
  const langL = pick3(L.label, locale); const useL = pick3(U.label, locale);
  const isZh = locale.startsWith('zh');
  const title = isZh
    ? `${langL}${useL}|真人配音員試聽與免費報價 — Onyx Studios`
    : `${langL} ${useL} — Hear Vetted Voice Actors & Get a Free Quote | Onyx Studios`;
  const description = isZh
    ? (locale === 'zh-CN'
      ? `${langL}${useL}:试听经审核的真人配音员 demo,免费发案取得报价。标准交付 WAV 48kHz/24bit,常见 1-3 个工作天交件。`
      : `${langL}${useL}:試聽經審核的真人配音員 demo,免費發案取得報價。標準交付 WAV 48kHz/24bit,常見 1-3 個工作天交件。`)
    : `${langL} ${useL}: listen to vetted voice actor demos and post your project for a free quote. Standard delivery in WAV 48kHz/24-bit, typical turnaround 1-3 business days.`;
  return pageMetadata({ locale, route: `/voice-over/${lang}/${use}`, title, description });
}

type Snapshot = {
  name?: string; name_i18n?: Record<string, string>; languages?: string[];
  demos?: { category?: string; name?: unknown; url?: string }[];
  demo_urls?: { name?: string; url?: string }[]; sample_url?: string | null;
};

async function fetchDemos(match: string[], cats: string[], locale: string): Promise<DemoStripItem[]> {
  try {
    const db = getSupabaseServiceClient();
    // 過濾條件比照 /api/talents/roster(is_active + VO + 非 AI 聲音 + 已發佈快照)
    const { data } = await db.from('talents')
      .select('id, published_snapshot')
      .eq('is_active', true)
      .in('type', ['VO', 'voice_actor'])
      .or('voice_id_status.is.null,voice_id_status.neq.verified')
      .not('published_snapshot', 'is', null)
      .order('sort_order', { ascending: true })
      .limit(200);
    const items: DemoStripItem[] = [];
    for (const row of data || []) {
      const s = (row.published_snapshot || {}) as Snapshot;
      const langs = s.languages || [];
      if (!langs.some((v) => match.some((m) => String(v).startsWith(m)))) continue;
      // demo 優先取符合用途分類的,否則第一支,否則 legacy/樣本檔
      const demos = s.demos || [];
      const hit = demos.find((d) => d.url && cats.includes(String(d.category || ''))) || demos.find((d) => d.url);
      const url = hit?.url || s.demo_urls?.find((d) => d.url)?.url || s.sample_url || '';
      if (!url) continue;
      const nm = hit?.name;
      const demoName = typeof nm === 'string' ? nm : (nm as Record<string, string> | undefined)?.[locale] || (nm as Record<string, string> | undefined)?.en || '';
      items.push({
        talentId: String(row.id),
        name: s.name_i18n?.[locale] || s.name || 'Onyx Talent',
        demoName,
        url,
        profileHref: `/${locale}/talents/${row.id}`,
      });
      if (items.length >= 6) break;
    }
    return items;
  } catch { return []; }   // DB 失敗頁面照常出,只是沒有 demo 區
}

export default async function VoiceOverLandingPage({ params }: { params: Params }) {
  const { locale, lang, use } = await params;
  const L = voLang(lang); const U = voUse(use);
  if (!L || !U) notFound();

  const isZhCN = locale === 'zh-CN';
  const isZh = locale.startsWith('zh');
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);
  const langL = pick3(L.label, locale); const useL = pick3(U.label, locale);
  const combo = isZh ? `${langL}${useL}` : `${langL} ${useL}`;
  const demos = await fetchDemos(L.match, U.cats, locale);
  const hire = `/${locale}/hire`;

  const heroSub = U.isTts
    ? tx(
      `徵集與錄製${langL}母語者語音數據:專業設備錄製、交付 WAV 48kHz/24bit 乾聲,授權依個案簽署授權書。發案免費,報價依錄製時數與規格個案提供。`,
      `征集与录制${langL}母语者语音数据:专业设备录制、交付 WAV 48kHz/24bit 干声,授权按个案签署授权书。发案免费,报价按录制时数与规格提供。`,
      `${langL} voice data recording for TTS and AI training: native speakers, professional recording setups, dry WAV 48kHz/24-bit delivery, licensing per written agreement. Posting a project is free; quotes depend on hours and specs.`,
    )
    : tx(
      `經審核的${langL}真人配音員,${useL}實績試聽;發案免費、依案件長度與用途報價,標準交付 WAV 48kHz/24bit。`,
      `经审核的${langL}真人配音员,${useL}实绩试听;发案免费、按案件长度与用途报价,标准交付 WAV 48kHz/24bit。`,
      `Vetted ${langL} voice actors with real ${useL.toLowerCase()} demos. Posting a project is free; quotes are based on length and usage. Standard delivery: WAV 48kHz/24-bit.`,
    );

  const steps: [string, string][] = [
    [tx('免費發案', '免费发案', 'Post your project (free)'), tx('填寫案件內容與需求,不需註冊費用。', '填写案件内容与需求,无需注册费用。', 'Describe your script, style and deadline — no fees to post.')],
    [tx('試音與選人', '试音与选人', 'Auditions & shortlist'), tx('收到符合語言與聲線的配音員試音或 demo,直接比較選人。', '收到符合语言与声线的配音员试音或 demo,直接比较选人。', 'Receive auditions or demos from matching voice actors and pick your favorite.')],
    [tx('錄製與交付', '录制与交付', 'Record & deliver'), tx('線上收檔,標準規格 WAV 48kHz/24bit;廣告與旁白常見 1-3 個工作天交件。', '在线收档,标准规格 WAV 48kHz/24bit;广告与旁白常见 1-3 个工作天交件。', 'Files delivered online in WAV 48kHz/24-bit; commercials and narration typically take 1-3 business days.')],
  ];

  const faqs: [string, string][] = [
    [tx('費用怎麼計算?', '费用怎么计算?', 'How is pricing calculated?'),
      tx('依稿件長度、用途與授權範圍個案報價;發案與取得報價完全免費。', '按稿件长度、用途与授权范围个案报价;发案与获取报价完全免费。', 'Quotes are based on script length, usage and licensing scope. Posting a project and getting quotes is completely free.')],
    [tx('多快可以交件?', '多快可以交件?', 'How fast is delivery?'),
      tx('廣告與旁白常見 1-3 個工作天;遊戲等大量案件依份量另估(通常一週內)。', '广告与旁白常见 1-3 个工作天;游戏等大量案件按份量另估(通常一周内)。', 'Commercials and narration typically take 1-3 business days; larger game projects are estimated by volume (usually within a week).')],
    [tx('可以指定配音員嗎?', '可以指定配音员吗?', 'Can I request a specific voice actor?'),
      tx('可以。試聽本頁或配音員總覽的 demo 後,發案時直接指定。', '可以。试听本页或配音员总览的 demo 后,发案时直接指定。', 'Yes — listen to demos on this page or the full roster, then name your pick when posting.')],
    U.isTts
      ? [tx('數據的授權怎麼處理?', '数据的授权怎么处理?', 'How is data licensing handled?'),
        tx('每案簽署書面授權書,授權範圍、付款方式依案件約定;配音員試音前可先閱讀授權摘要。', '每案签署书面授权书,授权范围、付款方式按案件约定;配音员试音前可先阅读授权摘要。', 'Every project uses a written license agreement; scope and payment follow the per-project terms, which voice talent can review before auditioning.')]
      : [tx('需要 AI 聲音而不是真人?', '需要 AI 声音而不是真人?', 'Need an AI voice instead?'),
        tx('本頁為真人配音服務;AI 聲音庫請見 Voices 頁面。', '本页为真人配音服务;AI 声音库请见 Voices 页面。', 'This page is for human voice over. For AI voices, see our Voices library.')],
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: `${L.label.en} ${U.label.en}`,
    name: combo,
    provider: { '@type': 'Organization', name: 'Onyx Studios', url: 'https://www.onyxstudios.ai' },
    areaServed: 'Worldwide',
    url: `https://www.onyxstudios.ai/${locale}/voice-over/${lang}/${use}`,
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-gray-200">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <section className="max-w-4xl mx-auto px-5 pt-24 pb-12">
        <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">Onyx Studios · {tx('真人配音', '真人配音', 'Human Voice Over')}</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-4">{combo}</h1>
        <p className="text-[15px] text-gray-300 leading-relaxed max-w-2xl">{heroSub}</p>
        <div className="flex flex-wrap gap-3 mt-7">
          <a href={hire} className="px-6 py-3 rounded-full bg-white text-gray-900 text-sm font-semibold hover:bg-gray-200 transition-colors">
            {tx('免費發案取得報價', '免费发案获取报价', 'Post a project — free quote')}
          </a>
          <a href={`/${locale}/talents`} className="px-6 py-3 rounded-full border border-white/20 text-gray-200 text-sm font-medium hover:border-white/40 transition-colors">
            {tx('瀏覽全部配音員', '浏览全部配音员', 'Browse all voice actors')}
          </a>
        </div>
      </section>

      {demos.length > 0 && (
        <section className="max-w-4xl mx-auto px-5 pb-12">
          <h2 className="text-xl font-semibold text-white mb-4">{tx(`${langL}配音員試聽`, `${langL}配音员试听`, `${langL} voice actor demos`)}</h2>
          <DemoStrip items={demos} viewProfile={tx('看檔案', '看档案', 'Profile')} />
        </section>
      )}

      <section className="max-w-4xl mx-auto px-5 pb-12">
        <h2 className="text-xl font-semibold text-white mb-5">{tx('怎麼進行', '怎么进行', 'How it works')}</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {steps.map(([h, b], i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-5">
              <p className="text-xs text-gray-400 mb-1.5">{i + 1}</p>
              <p className="text-sm font-semibold text-white mb-1.5">{h}</p>
              <p className="text-[13px] text-gray-300 leading-relaxed">{b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-5 pb-16">
        <h2 className="text-xl font-semibold text-white mb-5">FAQ</h2>
        <div className="space-y-3">
          {faqs.map(([q, a], i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-5">
              <p className="text-sm font-semibold text-white mb-1.5">{q}</p>
              <p className="text-[13px] text-gray-300 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <a href={hire} className="inline-block px-8 py-3.5 rounded-full bg-white text-gray-900 text-sm font-semibold hover:bg-gray-200 transition-colors">
            {tx('免費發案取得報價', '免费发案获取报价', 'Post a project — free quote')}
          </a>
        </div>
      </section>
      <Footer />
    </main>
  );
}
