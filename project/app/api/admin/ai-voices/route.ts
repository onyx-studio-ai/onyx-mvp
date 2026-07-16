import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { createSpeakerEmbedding, generateVoice, TtsError } from '@/lib/tts/engine';
import { invalidateVoiceCache } from '@/lib/tts/voice-embeddings';

/*
  AI 聲音管理(Phase 1,交接:VOICE_LAB/交接_Phase1_AI聲音管理頁.md)。
  Wing 後台自助:配音員錄音 → whisper 逐字稿(過目可修)→ clone → 試聽 → 上架。

  GET                        → 全部聲音列(talent_voice_embeddings,含 off)
  POST { action:'transcribe', audio_url, language? }
                             → fal wizper 轉逐字稿(refText 鐵律:必須是該音檔的真實逐字稿)
  POST { action:'clone', voice_key, label, tone, audio_url, ref_text, talent_id?, temperature? }
                             → createSpeakerEmbedding → safetensors 轉存自家 tts-embeddings
                               bucket(fal 回的是暫時 URL)→ 寫 DB(status='off',試聽滿意才上架)
  POST { action:'test', id, text, language? }
                             → 用該列 embedding 直接生短句試聽(不看 status,off 也能試)
  PATCH { id, status? | ref_text? | temperature? | is_default_tone? } → 更新;上/下架
*/

export const runtime = 'nodejs';
export const maxDuration = 120;   // clone + 轉存 + 試聽都在一分鐘級

const TONES = ['professional', 'energetic', 'soothing', 'trailer', 'friendly'];

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const db = getSupabaseServiceClient();
  const { data, error } = await db.from('talent_voice_embeddings')
    .select('id, voice_key, talent_id, label, tone, embedding_url, ref_text, temperature, is_default_tone, status, created_at')
    .order('voice_key').order('tone');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ voices: data || [], tones: TONES });
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const db = getSupabaseServiceClient();

  // ── whisper 轉逐字稿(fal wizper = Whisper v3 Large,中文 OK)──
  if (b.action === 'transcribe') {
    const audioUrl = String(b.audio_url || '');
    if (!/^https?:\/\//.test(audioUrl)) return NextResponse.json({ error: 'audio_url 必須是公開網址' }, { status: 400 });
    const key = process.env.FAL_KEY;
    if (!key) return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 503 });
    const res = await fetch('https://fal.run/fal-ai/wizper', {
      method: 'POST', headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_url: audioUrl, task: 'transcribe', ...(b.language ? { language: String(b.language) } : {}) }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ error: `轉稿失敗:${j?.detail || res.status}` }, { status: 502 });
    const text = String(j.text || (Array.isArray(j.chunks) ? j.chunks.map((c: { text?: string }) => c.text || '').join('') : '')).trim();
    if (!text) return NextResponse.json({ error: '轉稿結果為空,請確認音檔' }, { status: 422 });
    return NextResponse.json({ text });
  }

  // ── clone:建立聲音(存 off,試聽滿意才上架)──
  if (b.action === 'clone') {
    const voiceKey = String(b.voice_key || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const tone = String(b.tone || '').trim();
    const audioUrl = String(b.audio_url || '');
    const refText = String(b.ref_text || '').trim();
    if (!voiceKey || !TONES.includes(tone) || !/^https?:\/\//.test(audioUrl) || !refText) {
      return NextResponse.json({ error: 'voice_key / tone / audio_url / ref_text 必填(refText 必須是音檔逐字稿)' }, { status: 400 });
    }
    try {
      // 1) fal clone → 暫時 safetensors URL
      const tmpUrl = await createSpeakerEmbedding(audioUrl, refText);
      // 2) 轉存自家 bucket(永久;fal URL 會過期)
      const bin = await fetch(tmpUrl);
      if (!bin.ok) return NextResponse.json({ error: `embedding 下載失敗(${bin.status})` }, { status: 502 });
      const buf = Buffer.from(await bin.arrayBuffer());
      const path = `${voiceKey}_${tone}_${Date.now()}.safetensors`;
      const { error: upErr } = await db.storage.from('tts-embeddings').upload(path, buf, { contentType: 'application/octet-stream', upsert: false });
      if (upErr) return NextResponse.json({ error: `embedding 存檔失敗:${upErr.message}` }, { status: 500 });
      const publicUrl = `${(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '')}/storage/v1/object/public/tts-embeddings/${path}`;
      // 3) 寫 DB(同 voice+tone 重建 = 覆蓋舊列)
      const row = {
        voice_key: voiceKey,
        talent_id: b.talent_id ? String(b.talent_id) : null,
        label: String(b.label || voiceKey).slice(0, 120),
        tone,
        embedding_url: publicUrl,
        ref_text: refText.slice(0, 2000),
        temperature: b.temperature != null && b.temperature !== '' ? Number(b.temperature) : null,
        status: 'off',
      };
      const { data, error } = await db.from('talent_voice_embeddings').upsert(row, { onConflict: 'voice_key,tone' }).select('id').single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      invalidateVoiceCache();
      return NextResponse.json({ ok: true, id: data.id, embedding_url: publicUrl });
    } catch (err) {
      const msg = err instanceof TtsError ? err.message : (err instanceof Error ? err.message : 'clone 失敗');
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  // ── 試聽(off 也能試;短句直生)──
  if (b.action === 'test') {
    const id = String(b.id || '');
    const text = String(b.text || '').slice(0, 200) || '您好,這是聲音試聽,感謝您使用 Onyx Studios。';
    const { data: row } = await db.from('talent_voice_embeddings').select('embedding_url, ref_text, temperature').eq('id', id).maybeSingle();
    if (!row) return NextResponse.json({ error: '找不到這個聲音' }, { status: 404 });
    try {
      const result = await generateVoice({
        text, language: String(b.language || 'zh-TW'),
        embeddingUrl: row.embedding_url, refText: row.ref_text,
        preview: true, modelSize: '1.7B',
        temperature: row.temperature != null ? Number(row.temperature) : undefined,
      });
      return NextResponse.json(result);
    } catch (err) {
      const msg = err instanceof TtsError ? err.message : '生成失敗';
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}

export async function PATCH(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const id = String(b.id || '');
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
  const db = getSupabaseServiceClient();
  const upd: Record<string, unknown> = {};
  if (b.status !== undefined) upd.status = b.status === 'live' ? 'live' : 'off';
  if (b.ref_text !== undefined) upd.ref_text = String(b.ref_text).slice(0, 2000);
  if (b.temperature !== undefined) upd.temperature = b.temperature === null || b.temperature === '' ? null : Number(b.temperature);
  if (b.label !== undefined) upd.label = String(b.label).slice(0, 120);
  if (!Object.keys(upd).length && b.is_default_tone === undefined) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  if (Object.keys(upd).length) {
    const { error } = await db.from('talent_voice_embeddings').update(upd).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // 預設 tone:同 voice_key 只能一個 → 先全清再設
  if (b.is_default_tone === true) {
    const { data: row } = await db.from('talent_voice_embeddings').select('voice_key').eq('id', id).maybeSingle();
    if (row) {
      await db.from('talent_voice_embeddings').update({ is_default_tone: false }).eq('voice_key', row.voice_key);
      await db.from('talent_voice_embeddings').update({ is_default_tone: true }).eq('id', id);
    }
  }
  invalidateVoiceCache();
  return NextResponse.json({ ok: true });
}
