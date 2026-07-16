// Persistent fal speaker embeddings for OUR talents. Created once via fal clone-voice,
// the safetensors stored in our Supabase `tts-embeddings` bucket (permanent, not fal's
// temp URL). Maps a stable voiceId → per-tone embeddings + each tone's ref transcript.
//
// Per-tone: Qwen3 carries the emotional register from the REF clip, not from a style
// prompt — so to let a customer preview the tone they picked (Professional / Energetic /
// …), each tone is cloned from a ref clip in that register. The ref transcript MUST match
// the clip's audio or the clone breaks ("很奇怪" — see feedback memory); refText is reused
// at inference time as Qwen3's reference_text.
//
// 2026-07-16 Phase 1:正式來源改為 DB 表 `talent_voice_embeddings`(後台「AI 聲音」頁
// 管理);本檔硬編碼降級為「後備」—— DB 空/表未建時仍可生成,不斷線。快取 60 秒。
// (quality = fal-clone "像也不像") eventually swap to BreezyVoice (self-host pod).
export interface ToneEmbedding {
  embeddingUrl: string;
  refText: string;
  // Optional per-tone sampling temperature. For talents with only ONE register
  // cloned (e.g. 阿宏), we point every tone at the same embedding but nudge
  // temperature so the registers differ a little (higher = livelier, lower =
  // steadier) — Wing's "一點點分別,不用差太多". Omit → engine default 0.7.
  temperature?: number;
}

export interface VoiceEmbedding {
  label: string;
  // Tone to fall back to when the requested one isn't recorded for this voice.
  defaultTone: string;
  tones: Record<string, ToneEmbedding>;
}

const SB = 'https://hnblwckpnapsdladcjql.supabase.co/storage/v1/object/public/tts-embeddings';

// UI tone value (TONE_VALUES in voice/create) → tone key here.
export const UI_TONE_MAP: Record<string, string> = {
  Professional: 'professional',
  Energetic: 'energetic',
  Soothing: 'soothing',
  'Movie Trailer': 'trailer',
  Friendly: 'friendly',
};

export const VOICE_EMBEDDINGS: Record<string, VoiceEmbedding> = {
  'onyx-alpha': {
    label: 'Onyx Alpha (Eric / 楊日漢)',
    defaultTone: 'professional',
    tones: {
      professional: {
        embeddingUrl: `${SB}/eric_professional.safetensors`,
        refText: '高效防晒喷雾买一送一。提供全方位防护，让您在烈日下依然自信从容。',
      },
      energetic: {
        embeddingUrl: `${SB}/eric_energetic.safetensors`,
        refText: '年度最大电玩展强势登场！主机与游戏片整套购买，立即为您省下两千元。',
      },
      soothing: {
        embeddingUrl: `${SB}/eric_soothing.safetensors`,
        refText: '渴望打造温馨的居家空间吗？顶级窗帘预约丈量服务，全面免收安装费用。',
      },
      trailer: {
        embeddingUrl: `${SB}/eric_trailer.safetensors`,
        refText: '体验极致顺畅的清爽口感。顶级气泡水箱购专案，专人为您直接配送到府。',
      },
      friendly: {
        embeddingUrl: `${SB}/eric_friendly.safetensors`,
        refText: '我是杨日翰我确认本段声音由我本人于2026年3月18号亲自录制',
      },
    },
  },
  'onyx-bravo': {
    label: 'Onyx Bravo (阿宏 / 呂冠彥)',
    defaultTone: 'friendly',
    // Real per-register embeddings cloned from 阿宏's emotion clips (Wing verified each
    // matches its tone). refText = whisper transcript of each clip (drama dialogue).
    tones: {
      professional: {
        embeddingUrl: `${SB}/onyx_bravo_promo.safetensors`,
        refText:
          '俗话说，下雨天，流客天，主人不流老天流。欸，陶部长可真是神通广大，好像哪的人都熟。等他还认为',
      },
      soothing: {
        // Cloned from 阿宏's own 安慰/comfort clip, ref pre-slowed (atempo 0.72) so the
        // calm-slow pace bakes into the embedding — no serverless post-processing needed
        // (Wing approved 慢B speed). refText = whisper of the slowed clip.
        embeddingUrl: `${SB}/onyx_bravo_soothing.safetensors`,
        refText:
          '你先不要自己嚇自己啦說不定你家忙期末考啊或是打工啊他不是在打工嗎應該蠻忙的吧你可以試試看他回慢的時候你也把這個時間回的比較長一點',
        // soothing is the most rambling-prone register → lower temperature for stability.
        temperature: 0.5,
      },
      energetic: {
        embeddingUrl: `${SB}/onyx_bravo_excited.safetensors`,
        refText:
          '欸，大妹子，這是銀書記的原話，你還記得這麼熟啊。你們兩個真的就在飯店的客房裡住下來了，是嗎？',
      },
      trailer: {
        embeddingUrl: `${SB}/onyx_bravo_angry.safetensors`,
        refText:
          '如若失败，那就是你一瓶，我一瓶，喝掉它。我看这就不必了，铁哥们，一家人没说的。可是，你也太过分了，太不把我当人了。',
      },
      friendly: {
        embeddingUrl: `${SB}/onyx_bravo.safetensors`,
        refText:
          '哇这问题问得很好耶，我班上的女生都很爱聊这个，如果你想要皮肤水嫩一点可以吃奇异果或是芭乐，他们的维他命C很多，比柠檬还厉害。',
      },
    },
  },
};

// ── DB 來源(Phase 1)───────────────────────────────────────────────────────
// talent_voice_embeddings:voice_key / tone / embedding_url / ref_text / temperature /
// is_default_tone / status('live'|'off')。只取 live。60 秒記憶體快取(serverless 實例內)。
type DbRow = { voice_key: string; tone: string; embedding_url: string; ref_text: string; temperature: number | null; is_default_tone: boolean | null; status: string };
let _cache: { at: number; map: Map<string, DbRow[]> } | null = null;

async function loadDbVoices(): Promise<Map<string, DbRow[]>> {
  if (_cache && Date.now() - _cache.at < 60_000) return _cache.map;
  const map = new Map<string, DbRow[]>();
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '', { auth: { autoRefreshToken: false, persistSession: false } });
    const { data } = await db.from('talent_voice_embeddings').select('voice_key, tone, embedding_url, ref_text, temperature, is_default_tone, status').eq('status', 'live');
    for (const r of (data || []) as DbRow[]) {
      const arr = map.get(r.voice_key) || [];
      arr.push(r); map.set(r.voice_key, arr);
    }
  } catch { /* 表未建/DB 掛 → 空 map,走硬編碼後備 */ }
  _cache = { at: Date.now(), map };
  return map;
}

/** 讓「建立聲音/上下架」立刻生效(clone 完馬上能試聽,不用等 60 秒)。 */
export function invalidateVoiceCache() { _cache = null; }

// Resolve a voiceId (+ optional UI tone value) to a concrete embedding. DB 優先,
// 查無此 voice 才落回硬編碼後備;tone 沒錄的落回該聲音的預設 tone。
export async function getVoiceEmbedding(
  id: string,
  uiTone?: string,
): Promise<(ToneEmbedding & { tone: string }) | null> {
  const toneKey = (uiTone && UI_TONE_MAP[uiTone]) || '';
  const rows = (await loadDbVoices()).get(id);
  if (rows && rows.length) {
    const pick = (rows.find((r) => toneKey && r.tone === toneKey))
      || rows.find((r) => r.is_default_tone)
      || rows[0];
    return { embeddingUrl: pick.embedding_url, refText: pick.ref_text, temperature: pick.temperature ?? undefined, tone: pick.tone };
  }
  const voice = VOICE_EMBEDDINGS[id];
  if (!voice) return null;
  const key = toneKey && voice.tones[toneKey] ? toneKey : voice.defaultTone;
  const emb = voice.tones[key];
  if (!emb) return null;
  return { ...emb, tone: key };
}
