// 生成部落格封面圖:編輯雜誌風,深色底 + 專屬主色 + 概念詞 + 精緻聲波母題。
// 用 Chrome headless 把 HTML 渲染成 1600x900 PNG。
// 用法:node scripts/gen-blog-covers.mjs [slug]   不帶 slug = 全部
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = new URL('../public/blog/', import.meta.url).pathname;

// 每篇:專屬主色(深色底上的高級強調色)、kicker、概念詞、一句英文副標、波形 seed。
// 主色 + 概念詞 + 波形形狀三者都不同 —— 系列一致但每篇可辨識。
const POSTS = [
  { slug: 'gene-wilder-ai-voice-what-permission-requires', color: '#E3A857',
    kicker: 'AI VOICE · LICENSING', concept: 'Permission.',
    sub: "Netflix recreated Gene Wilder's voice — with consent", seed: 7 },
  { slug: 'quality-check-ai-voice-language-you-dont-speak', color: '#45B3A3',
    kicker: 'LOCALIZATION · QA', concept: 'Fluent, Not Right',
    sub: 'AI speaks 40 languages. It still gets them wrong.', seed: 13 },
  { slug: 'ai-voice-tool-landscape-2026', color: '#7C9EF0',
    kicker: 'BUYER GUIDE · TOOLS', concept: 'Which to Trust',
    sub: 'Every tool sounds flawless in a ten-second demo', seed: 21 },
  { slug: 'will-ai-replace-voice-actors', color: '#E88AA0',
    kicker: 'INDUSTRY · VOICE ACTORS', concept: 'Human or AI',
    sub: 'What the data actually says about replacement', seed: 34 },
  { slug: 'cloning-a-voice-5-things', color: '#A88BF5',
    kicker: 'VOICE CLONING · CONSENT', concept: 'Before You Clone',
    sub: 'Five things to get right — legally and technically', seed: 42 },
  { slug: 'ai-music-commercial-licensing', color: '#D4B24C',
    kicker: 'AI MUSIC · LICENSING', concept: 'Cleared to Use?',
    sub: "Royalty-free isn't the same as risk-free", seed: 55 },
  { slug: 'dub-one-video-into-10-languages', color: '#5FB8E0',
    kicker: 'DUBBING · LOCALIZATION', concept: 'Ten Languages',
    sub: 'Dub one video — and the step that decides if it ships', seed: 63 },
  { slug: 'how-generative-voice-ai-works', color: '#7FC98A',
    kicker: 'EXPLAINER · TECHNOLOGY', concept: 'How It Works',
    sub: 'Generative voice AI, in four steps and plain language', seed: 71 },
  { slug: 'ai-music-generators-suno-udio', color: '#D57CD0',
    kicker: 'AI MUSIC · TOOLS', concept: 'Suno vs Udio',
    sub: "What they do well — and what they still can't deliver", seed: 88 },
  { slug: 'why-ai-mandarin-sounds-mainland', color: '#E8925A',
    kicker: 'MANDARIN · ACCENT', concept: 'Why It Sounds Off',
    sub: 'Most AI Mandarin defaults to a mainland accent', seed: 96 },
  { slug: 'that-ad-voice-might-be-borrowed', color: '#E07A72',
    kicker: 'ETHICS · CONSENT', concept: 'Borrowed?',
    sub: 'Many synthetic ad voices came from someone who never agreed', seed: 104 },
  { slug: 'hidden-cost-of-free-ai-voices', color: '#B6C960',
    kicker: 'COST · QUALITY', concept: 'The Real Price',
    sub: "The sticker price of an AI voice isn't its real price", seed: 117 },
];

// 概念詞越長字級越小,避免撐破版面。
const conceptSize = (s) => (s.length <= 11 ? 150 : s.length <= 16 ? 124 : 104);

// 確定性聲波高度(避免每次跑都變):多頻 sine 疊加 + 中心加權。
function bars(seed, n = 68) {
  const a = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const env = 0.35 + 0.65 * Math.pow(Math.sin(Math.PI * t), 0.7); // 兩端收窄
    const w =
      0.55 * Math.sin(t * 9.1 + seed) +
      0.30 * Math.sin(t * 21.3 + seed * 2.1) +
      0.15 * Math.sin(t * 41.7 + seed * 3.7);
    const h = env * (0.5 + 0.5 * Math.abs(w));
    a.push(Math.max(0.06, h));
  }
  return a;
}

function html(p) {
  const bs = bars(p.seed);
  const barsHtml = bs
    .map((h) => `<span style="height:${(h * 100).toFixed(1)}%"></span>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1600px;height:900px;overflow:hidden}
  .card{position:relative;width:1600px;height:900px;background:#08080A;
    font-family:-apple-system,"SF Pro Display","Helvetica Neue",sans-serif;
    color:#fff;overflow:hidden}
  /* 主色微光:右上大徑向光暈 */
  .glow{position:absolute;inset:0;
    background:radial-gradient(120% 90% at 88% 8%, ${p.color}26 0%, transparent 55%),
      radial-gradient(90% 70% at 8% 100%, ${p.color}12 0%, transparent 60%);}
  /* 細格線,增加質感 */
  .grid{position:absolute;inset:0;opacity:.5;
    background-image:linear-gradient(#ffffff07 1px,transparent 1px);
    background-size:100% 90px;}
  .frame{position:absolute;inset:56px;border:1px solid #ffffff12;border-radius:20px}
  .wordmark{position:absolute;top:92px;left:96px;display:flex;align-items:center;gap:14px;
    font-size:22px;letter-spacing:.42em;font-weight:600;color:#fff}
  .dot{width:11px;height:11px;border-radius:50%;background:${p.color};
    box-shadow:0 0 18px ${p.color}}
  .body{position:absolute;left:96px;top:264px;right:96px}
  .kicker{font-size:26px;letter-spacing:.34em;font-weight:600;color:${p.color};
    text-transform:uppercase;margin-bottom:30px}
  .concept{font-size:${conceptSize(p.concept)}px;line-height:.98;font-weight:700;
    letter-spacing:-.03em;color:#fff;text-shadow:0 2px 60px #00000060}
  .sub{margin-top:38px;font-size:30px;line-height:1.4;font-weight:400;color:#ffffffb0;
    max-width:1000px}
  /* 聲波:底部一排發光 bar */
  .wave{position:absolute;left:96px;right:96px;bottom:104px;height:150px;
    display:flex;align-items:flex-end;gap:7px}
  .wave span{flex:1;border-radius:6px;
    background:linear-gradient(to top, ${p.color}, ${p.color}88);
    box-shadow:0 0 14px ${p.color}55;min-height:5px}
  /* 與 wordmark 對齊在頂端,避免壓到底部聲波 */
  .url{position:absolute;top:96px;right:96px;font-size:21px;letter-spacing:.06em;
    color:#ffffff66;font-weight:500}
</style></head><body>
  <div class="card">
    <div class="glow"></div><div class="grid"></div><div class="frame"></div>
    <div class="wordmark"><span class="dot"></span>ONYX STUDIOS</div>
    <div class="body">
      <div class="kicker">${p.kicker}</div>
      <div class="concept">${p.concept}</div>
      <div class="sub">${p.sub}</div>
    </div>
    <div class="wave">${barsHtml}</div>
    <div class="url">onyxstudios.ai</div>
  </div>
</body></html>`;
}

const only = process.argv[2];
const list = only ? POSTS.filter((p) => p.slug === only) : POSTS;
mkdirSync(OUT, { recursive: true });
for (const p of list) {
  const tmp = join(tmpdir(), `cover-${p.slug}.html`);
  writeFileSync(tmp, html(p));
  const out = join(OUT, `${p.slug}-hero.png`);
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--window-size=1600,900',
    `--screenshot=${out}`, `file://${tmp}`,
  ], { stdio: 'ignore' });
  console.log('✓', out);
}
