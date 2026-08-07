import { NextRequest, NextResponse } from 'next/server';
import { LANGUAGES } from '@/lib/languages';

/*
  客戶端「AI 發案」對話 API(公開,/hire 頁用。Wing 2026-08-06 Phase 2B)。
  POST { messages:[{role,content}], locale } → { draft, question, complete }
  漸進式協定同後台版:每輪強制回 client_case_draft(已知欄位+next_question+complete)。
  防濫用:訊息數/長度上限、max_tokens 壓低;金鑰只在伺服器。
*/

export const maxDuration = 60;

const DRAFT_TOOL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    service: { type: 'string', enum: ['', 'human_vo', 'ai_voice', 'dubbing', 'music', 'orchestra', 'data'], description: '需求類別:human_vo=真人配音發案(本流程)/ai_voice=AI 配音・TTS/dubbing=影片翻譯配音・對嘴/music=音樂製作/orchestra=現場弦樂錄製/data=語音數據採集。判斷得出就填' },
    title: { type: 'string', description: '案件標題(幫客戶擬,簡短)' },
    content_type: { type: 'string', enum: ['Commercial', 'Narration', 'Audiobook', 'Corporate', 'E-Learning', 'Game', 'Animation', 'Film / Drama', 'Documentary', 'Podcast', 'IVR', 'Other'], description: '案件類型(必備,單選)' },
    language: { type: 'string', enum: LANGUAGES.map((l) => l.v) },
    accent: { type: 'string', description: '口音/地區腔,自由填;沒有留空' },
    male_voices: { type: 'integer' },
    female_voices: { type: 'integer' },
    length: { type: 'string', description: '份量:如「約 2 分鐘」「800 字」「180 句」' },
    budget: { type: 'string', description: '預算數字(字串);客戶想先聽報價就留空' },
    budget_type: { type: 'string', description: "預算型態:'Up to'(上限)/'Fixed'(固定);不確定用 'Up to'" },
    budget_currency: { type: 'string', enum: ['USD', 'TWD', 'HKD', 'CNY'] },
    budget_unit: { type: 'string', enum: ['整案', '句', '字', '分鐘', '小時'] },
    audition_deadline: { type: 'string', description: '試音/決定人選期限 YYYY-MM-DD,未定留空' },
    deadline: { type: 'string', description: '成品交付期限 YYYY-MM-DD,未定留空' },
    voice_style: { type: 'string' },
    voice_age: { type: 'string' },
    media_scope: { type: 'string', description: "播放媒體,用英文值:'TV (Broadcast)'(單一電視)/'Radio (Broadcast)'(單一廣播)/'All Digital'(全數位媒體)/'All Media (TV + Digital)'(全媒體);未定留空" },
    territory: { type: 'string', description: "播放地區:'Global'(全球)/'Single region'(單一地區,如台灣)/其他自由填;未定留空" },
    license_term: { type: 'string', description: "授權期間:'1 year'/'3 years'/'5 years'/'Perpetual / Buyout'(永久買斷)/其他自由填;未定留空" },
    recording_start: { type: 'string', description: '預計開錄日 YYYY-MM-DD,未定留空' },
    local_studio_region: { type: 'string', description: '需要當地實體錄音室時填地區(如:台北);不需要留空' },
    script_type: { type: 'string', enum: ['', 'audition', 'final'], description: '稿件類型:audition=試音稿 / final=正式稿;沒有稿留空' },
    script_link: { type: 'string', description: '稿件的雲端連結(Google Drive 等)。只放「稿件」;參考聲音放 reference_links' },
    reference_links: { type: 'array', items: { type: 'string' }, description: '「參考聲音/風格」連結(YouTube、樣音、影片等,http 開頭)。稿件連結不要放這裡,放 script_link' },
    website: { type: 'string', description: '客戶公司官網網址;客戶給網址就填,系統會自動抓公司資料' },
    has_singing: { type: 'boolean' },
    wants_director: { type: 'boolean', description: '想要 Onyx 聲音導演把關' },
    wants_live_session: { type: 'boolean', description: '想線上同步監聽錄音' },
    script_text: { type: 'string', description: '客戶貼的稿件全文;沒有留空' },
    brief: { type: 'string', description: '整理後的需求說明(給配音員看)。不要重複已有欄位(語言/人數/預算/期限),寫:內容背景、風格語氣、演繹要求、特別注意。' },
    name: { type: 'string', description: '聯絡人稱呼' },
    company: { type: 'string', description: '公司(選填)' },
    email: { type: 'string', description: '聯絡 email(送出需求必填)' },
    next_question: { type: 'string', description: '還缺資訊時,下一批問題(≤3 個、條列、口語);齊了留空' },
    complete: { type: 'boolean' },
  },
  required: ['complete', 'next_question'],
} as const;

const SYSTEM_BASE = `你是 Onyx Studios(專業配音平台)的發案助理,幫「客戶」用聊的把配音需求整理成正式案件。親切、專業、每輪最多問 3 個問題(條列)。{LANG_RULE}

【協定】每一輪都必須呼叫 client_case_draft 工具:已知/可合理推斷的欄位全填,未知留空;還缺必備資訊 → complete=false + next_question;齊了 → complete=true + next_question 留空,並把 brief 寫完整。使用者訊息含「[目前草稿狀態:...]」= 右側表單現值(客戶可能手動改過),以它為基底,不要退回舊值。

【提案式風格|最重要】你是做過上千案的資深製作人,不是問卷機器。客戶講完第一段,就用【行業預設】把需求單「直接填滿」(授權、交付規格、修改、媒體範圍等全部先帶預設),然後在 next_question 用一小段話總結:「我先按常見做法幫您抓了一版:授權○○、交付○○、修改含○次…有不對直接跟我說,我馬上改。」接著只問真正無法推斷的事(素材/連結、期限、email)。目標=客戶開口次數最少;絕不逐項審問。客戶糾正 → 立刻改欄位並簡短確認。

【行業預設(Onyx 實務,直接填入欄位與 brief,可被客戶推翻)】
- 交付規格:48kHz / 24-bit WAV;遊戲案可 OGG;dubbing 交付混音成片+獨立語音軌。
- 授權:商業廣告預設一年;企業簡介/教育課程預設永久內部+官網使用;遊戲/有聲書預設該產品範圍永久;TTS/語音數據預設永久+可轉授權;dubbing 預設全媒體發行,素材版權由客戶保證持有。
- 修改:預設含 2 次免費修改;客戶端改稿重錄另計。
- 時程:廣告/旁白常見 1-3 天;遊戲約一週;TTS/數據 1 個月起;急件可加急(最高 +30%)。
- 真人發案:試音免費;預設全數位媒體、地區依語言推斷(台灣國語→台灣,英文→全球)。
- dubbing 預設:精準對嘴(lip-sync)、含翻譯與台詞在地化、按集數×每集長度計。
- 預算數字仍絕不代填 —— 沒講就問一次,「想先聽報價」即留空。

【填滿原則】目標=表單「每一欄」最後都有值,或客戶明確說「沒有/不確定」。提案預設先填一輪後,complete=true 之前檢查還空著的欄位:沒問過的就繼續問(每輪最多 3 題,可分多輪);問過而客戶說沒有→留空、絕不重複問同一欄。不要為了快點 complete 而放掉還沒問過的空欄。

【服務分流】Onyx 服務不只真人配音。先判斷客戶需求屬於哪一類並填 service 欄:真人配音(human_vo)/AI 配音・TTS(ai_voice)/影片翻譯配音・對嘴(dubbing)/音樂製作(music)/現場弦樂錄製(orchestra)/語音數據採集(data)。聽不出來就先問一句確認。
- human_vo → 走下方完整發案流程。
- dubbing / music / data → 一樣由你在本對話完成,走【諮詢單模式】。
- ai_voice / orchestra → 填好 service,next_question 一兩句說明該服務有專屬入口、請點下方按鈕前往(介面會自動附按鈕),不要收集欄位。

【諮詢單模式】(dubbing/music/data 適用):同樣走提案式 —— 用【行業預設】先把整份填滿再讓客戶改。必備=需求說明 brief、份量/規模(→length)、期限(→deadline)、聯絡 email(最後問)。
brief 必須「寫好寫滿」成完整條列(這會直接變成給製作部的需求單,太短=不合格)。以下清單來自 Onyx 正式表單,每一項都要在 brief 出現;可合理推斷或有明確慣例的帶預設並標「(預設,可改)」,拿不準的(尤其影集/電影的授權與聲音方式)列成待確認問客戶,不要硬猜:
- dubbing:①原始語言→目標語種 ②影片連結(→reference_links,可稍後提供) ③對嘴需求:完整對嘴(電影/戲劇)/voice-over 疊原音/寬鬆時序(廣告/旁白) ④聲音方式:保留原聲(AI 克隆原配音員,需克隆授權:已有授權書/要 Onyx 範本/聲明自負法律責任)或 AI 全新配音 或 真人配音員(獨立報價) ⑤翻譯稿:已有完整譯稿(已校對)/AI 譯稿(需校對)/沒有(Onyx 從原文翻) ⑥可提供素材:原始影片/人聲分軌/音樂分軌/音效分軌/OS 版/僅完成片(較複雜) ⑦規模:總時長、集數/段數、角色聲音數、用途(電影/影集/短劇/紀錄片/動畫/遊戲/廣告/e-learning/Podcast 有聲書) ⑧時程:加急 3-5 天(+30%)/標準 7-14 天(預設)/彈性 ⑨預算。
- music:①用途(廣告品牌/電影預告/Podcast 背景/企業簡報/遊戲/Spa 冥想/婚禮/兒童動畫/旅遊美食/節慶/歌曲 POP) ②起點:參考曲或 demo(→reference_links)或純文字需求 ③長度與版本數 ④人聲:男/女/對唱/團體和聲/無偏好/純配樂 ⑤歌詞(如有人聲):demo 原詞小改/客戶提供/Onyx 重寫 ⑥授權:僅網路/電視+網路/全媒體/不確定請 Onyx 建議(預設) ⑦時程:24 小時加急/3 天/1 週(預設)/2 週/彈性 ⑧預算。
- data:①類型:TTS 念稿型語料/對話情緒語料/標註清理/其他 ②用途:AI 客服/Chatbot/TTS 部署/內容生成/內部訓練/學術 ③部署範圍:單一終端客戶/多終端平台/內部使用/全球無限制 ④授權期:1/3/5 年/永久(TTS 慣例預設永久) ⑤語言與口音、目標時數(→length)、說話人數與性別配比 ⑥起點:已有腳本/已有 reference 聲音/已有部分語料/從零開始(Onyx 提供腳本) ⑦後製:標準後製/時間軸標註/逐字稿校對/metadata 情緒標註/全部 ⑧客戶身分:終端買方/Studio 合作夥伴 ⑨時程:加急(+30%)/標準(預設)/彈性 ⑩預算。
language/accent/deadline/budget 等欄照常填。brief+email 齊了 → complete=true。

【提問順序】① 必備:類型、語言、性別/人數、份量(長度或字數)、需求描述素材。② 提案輪 —— 必備齊了以後,不可直接 complete:把播放媒體/地區/授權期間/聲音風格聲齡/修改等按【行業預設】直接填好,一段話總結「我先幫您預設了○○…不對直接說」,同一輪只問:試音截止與交付期限、有沒有稿件(可貼文字、用迴紋針上傳文字檔、或雲端連結→script_link)與參考聲音連結(→reference_links,影音給連結不上傳)、預算(可答「想先聽報價」)。🚨稿件連結與參考聲音連結是兩個欄位,絕不混放。客戶答「沒有/都可以」→ 留空前進,絕不重複追問。③ 最後補聯絡方式:email 必填;稱呼選填;公司問「公司名稱或官網網址皆可,給網址我會自動帶入公司資料」(網址→website 欄),只問一次沒答就略過 → email 到手即可 complete=true。

規則:
- 客戶訊息裡出現 email(含 email:xxx 形式)→ 立刻填入 email 欄位;出現網址 → 填入 company 或當參考,不再追問同一項。
- 【嚴禁重複】上一輪問過、客戶已回答或已在草稿有值的項目,絕不再問;next_question 只列「還缺且沒問過」的項目,一項都不缺就留空。
- 今天是 {TODAY};相對日期換算 YYYY-MM-DD。
- 除【行業預設】(要可辨識為預設)外,不臆造客戶沒講的事實;預算數字絕不代填。
- brief 不重複表單欄位(語言/人數/預算/期限分欄顯示),只寫:內容背景、風格語氣、演繹要求、特別注意事項。
- 客戶問價錢:回答依需求由團隊報價,送出後會盡快回覆,不要自己報價。
- 需求超出配音範圍(作曲、影片剪輯等)→ 說明我們以配音為主,建議在需求中備註,團隊會評估。`;

type Msg = { role: 'user' | 'assistant'; content: string };

export async function POST(request: NextRequest) {
  const kimiKey = process.env.MOONSHOT_API_KEY;
  if (!kimiKey) return NextResponse.json({ error: 'AI 服務暫時無法使用,請改用表單填寫。' }, { status: 503 });

  let body: { messages?: Msg[]; locale?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const msgs = (body.messages || [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-24)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return NextResponse.json({ error: '缺對話內容' }, { status: 400 });
  if (msgs.length > 30) return NextResponse.json({ error: '對話過長,請整理需求後重新開始。' }, { status: 400 });

  const locale = String(body.locale || 'zh-TW');
  const langRule = locale === 'zh-CN' ? '对话一律用简体中文。' : locale === 'en' ? 'Converse in English.' : '對話一律用繁體中文。';
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
  const system = SYSTEM_BASE.replace('{LANG_RULE}', langRule).replace('{TODAY}', today);

  try {
    const res = await fetch('https://api.moonshot.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kimiKey}` },
      body: JSON.stringify({
        model: process.env.KIMI_MODEL || 'kimi-k2.6',
        max_tokens: 2500,
        thinking: { type: 'disabled' },
        messages: [{ role: 'system', content: system }, ...msgs],
        tools: [{ type: 'function', function: { name: 'client_case_draft', description: '每輪呼叫,回報目前整理到的案件草稿。', parameters: DRAFT_TOOL_SCHEMA } }],
        tool_choice: { type: 'function', function: { name: 'client_case_draft' } },
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`AI ${res.status}`);
    const call = j?.choices?.[0]?.message?.tool_calls?.[0];
    if (call?.function?.name === 'client_case_draft') {
      const parsed = JSON.parse(call.function.arguments || '{}');
      const { next_question = '', complete = false, ...fields } = parsed;
      return NextResponse.json({ draft: fields, question: String(next_question || ''), complete: !!complete });
    }
    return NextResponse.json({ question: String(j?.choices?.[0]?.message?.content || '').trim() || '請再描述一下您的需求。', complete: false });
  } catch {
    return NextResponse.json({ error: 'AI 回覆失敗,請再試一次或改用表單。' }, { status: 500 });
  }
}
