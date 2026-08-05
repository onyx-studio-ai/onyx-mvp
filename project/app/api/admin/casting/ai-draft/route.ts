import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { LANGUAGES } from '@/lib/languages';

/*
  後台「AI 發案」對話 API(Wing 專用,Fiverr 式問答發案。2026-08-05)。
  POST { messages: [{role:'user'|'assistant', content:string}] }
    → { reply: string }(AI 追問缺的欄位)或 { draft: {...} }(欄位齊了,產出結構化草稿)。
  前端把 draft 寫進 localStorage 'onyx-draft:casting-new'(與發案表單共用的草稿槽)。

  供應商:MOONSHOT_API_KEY 有設 → Kimi(OpenAI 相容,便宜,Wing 有 $10 額度);
         否則 ANTHROPIC_API_KEY → Claude。模型可用 KIMI_MODEL 覆寫(預設 kimi-k2.5)。
  GET ?models=1 → 列 Moonshot 帳號可用模型(debug 用,確認模型 ID)。
*/

const CATEGORIES = ['廣告 Commercial', '旁白 Narration', '有聲書 Audiobook', '工商簡介 Corporate', '教育教學 E-Learning', '紀錄片 Documentary', '電視 TV', '廣播電台 Radio', '電影預告 Trailer', '網路影片 Web Video', 'Podcast', '來電語音 IVR', '語音助理 Voice Assistant', '新聞播報 News', '流行歌配唱 Pop Singing', '遊戲 Video Game', '動畫 Animation', '戲劇·角色 Drama', '角色配唱 Character Singing', 'TTS / AI 語音'];

// 草稿 JSON Schema —— Anthropic tool 與 OpenAI function 共用同一份。
const DRAFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string', description: '案件標題,格式仿現有案例,如「TTS / 語音合成(自由對話)5小時 上海話」「英語有聲書旁白 · 男聲+女聲」' },
    category: { type: 'string', enum: CATEGORIES },
    language: { type: 'string', enum: LANGUAGES.map((l) => l.v), description: '平台語言標準值' },
    accent: { type: 'string', description: '口音,自由填,如「美式 / 英式」「泉州 / 漳州 / 廈門」;沒有留空' },
    male_voices: { type: 'integer', description: '需要男聲人數,不限/未知填 0' },
    female_voices: { type: 'integer', description: '需要女聲人數,不限/未知填 0' },
    brief: { type: 'string', description: '案件說明全文(對配音員展示)。照 Onyx 慣例:需求描述+形式+錄音規格(如 48kHz/24bit/mono)+報名時要在「報價說明」注明的事項。目標大陸市場用簡體、英語案用英文、其餘繁中。' },
    audition_script: { type: 'string', description: '試音稿(有指定稿才填;沒有留空=用 demo 應徵)' },
    rate_mode: { type: 'string', enum: ['fixed', 'range', 'upto', 'plus'], description: '報酬型態:固定/區間/最高/起價' },
    rate_currency: { type: 'string', enum: ['TWD', 'USD', 'CNY', 'EUR', 'GBP', 'JPY'] },
    rate_amount: { type: 'string', description: '金額(數字字串);配音員自報價時留空' },
    rate_amount2: { type: 'string', description: '區間上限,非區間留空' },
    rate_unit: { type: 'string', enum: ['整案', '句', '字', '分鐘', '小時'] },
    scale: { type: 'string', description: '份量:句數/字數/秒數/完成時數,如「5 完成小時」「1200 字」' },
    audition_deadline: { type: 'string', description: '試音截止 YYYY-MM-DD' },
    audition_deadline_time: { type: 'string', description: 'HH:mm,未指定留空' },
    delivery_deadline: { type: 'string', description: '交付截止 YYYY-MM-DD,未定留空' },
    delivery_deadline_time: { type: 'string' },
    timezone: { type: 'string', enum: ['Asia/Taipei', 'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Tokyo', 'Europe/London', 'America/New_York', 'America/Los_Angeles'] },
    media_scope: { type: 'string', description: '使用範圍,如「網路廣告」「全媒體」;未定留空' },
    territory: { type: 'string', description: '授權地區;未定留空' },
    license_term: { type: 'string', description: '授權期間,如「1 年」「永久」;未定留空' },
    voice_style: { type: 'string', description: '聲音風格,如「溫暖親切」' },
    voice_age: { type: 'string', description: '聲齡,如「青年」「熟齡」;未定留空' },
    base_revisions: { type: 'string', description: '含修改次數,預設 1' },
    revision_cap: { type: 'string', description: '修改上限,預設 5' },
    has_singing: { type: 'boolean' },
    wants_director: { type: 'boolean' },
    methods: { type: 'object', additionalProperties: false, properties: { home: { type: 'boolean' }, studio: { type: 'boolean' }, online: { type: 'boolean' } }, required: ['home', 'studio', 'online'], description: '錄音方式:居家/錄音室/線上監錄' },
    ai_type: { type: 'string', enum: ['', 'clone', 'training'], description: '聲音會被做成 AI → clone;純訓練資料 → training;一般真人案 → 空字串' },
    client_note: { type: 'string', description: '內部備註(這案是哪個客戶的,只給後台看);不知道留空' },
    summary: { type: 'string', description: '給 Wing 的一句話摘要(草稿確認用,繁中)' },
  },
  required: ['title', 'category', 'language', 'brief', 'male_voices', 'female_voices', 'rate_mode', 'rate_currency', 'rate_unit', 'audition_deadline', 'timezone', 'methods', 'ai_type', 'summary'],
} as const;

const TOOL_DESC = '所有必備欄位收齊後呼叫,產出發案草稿。缺必備欄位(報酬未定、語言不明等)時不要呼叫,先追問。';

const SYSTEM = `你是 Onyx Studios 的後台發案助手,幫老闆 Wing 用最少的問答把配音案開起來(像 Fiverr 的 AI 發案)。全程繁體中文對話。

流程:Wing 丟需求(可能很口語、資訊零散)→ 你判斷還缺哪些「必備欄位」→ 一次問一批(最多 3-4 個問題、條列)→ 齊了就呼叫 case_draft 工具,不再多話。

必備欄位:類型、語言、性別/人數、內容份量、報酬(金額或明確「配音員自報價」)、試音截止日、錄音方式。能從描述合理推斷的就不要問(例:電話語音→來電語音 IVR;「找 AI 聲音要 clone」→ TTS / AI 語音 + ai_type=clone)。

鐵則:
- 報酬絕不自己編數字。Wing 沒講就問;說「讓他們自己報」就 rate_amount 留空、在 brief 註明報名時報價。
- 日期:今天是 {TODAY}。Wing 說「下週五」這類相對日期要換算成 YYYY-MM-DD。
- brief 文案風格照 Onyx 現有案件:開頭一段需求描述 → 形式/內容 → 錄音規格(正式交付通常 48 kHz / 24-bit / mono 乾聲,TTS 語料另要求底噪 < −60 dB、SNR > 45 dB)→ 「報名請在『報價說明』欄注明:①…②…③…」。目標大陸市場(方言/簡體客群)用簡體;英語案用英文;其餘繁中。
- AI/TTS 案(聲音會被拿去合成/訓練)一律 category=「TTS / AI 語音」+ ai_type(通常 clone),brief 裡不承諾授權細節(平台另有授權書流程)。
- 分角色案(遊戲/動畫/戲劇):角色資訊寫進 brief;告訴 Wing 角色列表可在表單裡再補。
- 不確定寧可問,不要猜(尤其對外會展示的內容)。`;

type Msg = { role: 'user' | 'assistant'; content: string };

async function askKimi(apiKey: string, system: string, msgs: Msg[]) {
  const model = process.env.KIMI_MODEL || 'kimi-k2.6';   // Wing 帳號實列:kimi-k3 / k2.7-code(×2) / k2.6(2026-08-05 驗證)
  const res = await fetch('https://api.moonshot.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model, max_tokens: 3000,   // k2.6 思考型模型只接受預設 temperature(=1),不能自訂
      messages: [{ role: 'system', content: system }, ...msgs],
      tools: [{ type: 'function', function: { name: 'case_draft', description: TOOL_DESC, parameters: DRAFT_SCHEMA } }],
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Kimi API ${res.status}: ${JSON.stringify(j).slice(0, 300)}`);
  const m = j?.choices?.[0]?.message;
  const call = m?.tool_calls?.[0];
  if (call?.function?.name === 'case_draft') {
    try { return { draft: JSON.parse(call.function.arguments || '{}') }; }
    catch { throw new Error('Kimi 草稿 JSON 解析失敗,請再試一次'); }
  }
  return { reply: String(m?.content || '').trim() };
}

async function askClaude(apiKey: string, system: string, msgs: Msg[]) {
  const client = new Anthropic({ apiKey });
  const resp = await client.messages.create({
    model: 'claude-opus-5', max_tokens: 3000, system,
    tools: [{ name: 'case_draft', description: TOOL_DESC, input_schema: DRAFT_SCHEMA as unknown as Anthropic.Tool.InputSchema }],
    messages: msgs,
  });
  const tool = resp.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'case_draft');
  if (tool) return { draft: tool.input as Record<string, unknown> };
  const text = resp.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n').trim();
  if (resp.stop_reason === 'refusal' || !text) return { reply: '這個需求我沒辦法處理,請換個說法或直接手動發案。' };
  return { reply: text };
}

export async function GET(request: NextRequest) {
  // debug:列 Moonshot 可用模型,確認模型 ID(admin only)
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const key = process.env.MOONSHOT_API_KEY;
  if (!key) {
    // 診斷:回報函式內 env 的「有/沒有」(不洩值),分辨「沒存對」vs「沒重佈」。
    const envKeys = Object.keys(process.env).filter((k) => /MOONSHOT|KIMI|ANTHROPIC/i.test(k));
    return NextResponse.json({ error: 'MOONSHOT_API_KEY 未設定', seen_ai_env_keys: envKeys, deployment: process.env.VERCEL_DEPLOYMENT_ID || null }, { status: 500 });
  }
  const res = await fetch('https://api.moonshot.ai/v1/models', { headers: { Authorization: `Bearer ${key}` } });
  const j = await res.json().catch(() => ({}));
  return NextResponse.json({ status: res.status, models: (j?.data || []).map((m: { id: string }) => m.id) });
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const kimiKey = process.env.MOONSHOT_API_KEY;
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (!kimiKey && !claudeKey) {
    return NextResponse.json({ error: '未設定 AI 金鑰 —— 請在 Vercel 環境變數加 MOONSHOT_API_KEY(Kimi)或 ANTHROPIC_API_KEY(Claude)後 Redeploy。' }, { status: 500 });
  }

  let body: { messages?: Msg[] };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const msgs = (body.messages || []).filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim()).slice(-30);
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return NextResponse.json({ error: '缺對話內容' }, { status: 400 });

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });   // YYYY-MM-DD
  const system = SYSTEM.replace('{TODAY}', today);
  try {
    const out = kimiKey ? await askKimi(kimiKey, system, msgs) : await askClaude(claudeKey!, system, msgs);
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'AI 呼叫失敗' }, { status: 500 });
  }
}
