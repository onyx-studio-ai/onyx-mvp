import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyLivenessToken } from '@/lib/liveness-token';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const MAX_BYTES = 15 * 1024 * 1024; // 15MB — a short live clip is tiny; cap abuse.

const EXT_BY_TYPE: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
};

// Talent-facing: receives the LIVE in-browser recording and files it privately.
// The signed token is the credential — no login. Upload (not a pre-made file) is
// the whole point, so we accept the recorded blob and mark status 'submitted'.
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const token = String(form.get('token') || '');
    const audio = form.get('audio');

    const talentId = verifyLivenessToken(token);
    if (!talentId) {
      return NextResponse.json({ error: 'invalid_or_expired' }, { status: 401 });
    }
    if (!(audio instanceof Blob) || audio.size === 0) {
      return NextResponse.json({ error: 'no_audio' }, { status: 400 });
    }
    if (audio.size > MAX_BYTES) {
      return NextResponse.json({ error: 'too_large' }, { status: 413 });
    }

    const type = audio.type || 'audio/webm';
    const ext = EXT_BY_TYPE[type.split(';')[0].trim()] || 'webm';
    const path = `${talentId}/${Date.now()}.${ext}`;
    const buf = Buffer.from(await audio.arrayBuffer());

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: upErr } = await db.storage
      .from('liveness')
      .upload(path, buf, { contentType: type, upsert: true });
    if (upErr) {
      console.error('[Liveness] upload error:', upErr);
      return NextResponse.json({ error: 'upload_failed' }, { status: 500 });
    }

    const { error: dbErr } = await db
      .from('talents')
      .update({
        liveness_status: 'submitted',
        liveness_recording_path: path,
        liveness_submitted_at: new Date().toISOString(),
      })
      .eq('id', talentId);
    if (dbErr) {
      console.error('[Liveness] status update error:', dbErr);
      return NextResponse.json({ error: 'save_failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Liveness] submit error:', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
