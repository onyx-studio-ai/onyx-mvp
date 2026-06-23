import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient, supabaseErrorResponse } from '@/lib/supabase-server';

/*
  Talent self-service demo upload. Auth'd by the talent's own session (Bearer
  token). Mints a one-time signed UPLOAD url into the PUBLIC talent-demos bucket,
  scoped to approved/<their-talent-id>/ so they can only write under their own
  folder. The client uploads via uploadToSignedUrl, then PATCHes demo_urls on
  /api/talent/me with the returned publicUrl.
*/

const BUCKET = 'talent-demos';
// MP3 only — keeps demos small/streamable and the player simple. (Product call:
// no video, no lossless dumps on the public profile.)
const ALLOWED_EXT = ['mp3'];

export async function POST(request: NextRequest) {
  try {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const db = getSupabaseServiceClient();
    const { data: userData, error: userErr } = await db.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });

    const { data: talent } = await db.from('talents').select('id').eq('auth_user_id', user.id).maybeSingle();
    if (!talent) return NextResponse.json({ error: 'No talent profile for this account' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const fileName = (body.fileName || '').trim();
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    if (!ext || !ALLOWED_EXT.includes(ext)) {
      return NextResponse.json({ error: 'Only MP3 files are accepted' }, { status: 400 });
    }

    // Opaque filename — never put the user's original filename in the path: it can
    // contain a phone/PII that would leak in the public URL (talents name files like
    // "brand_0975554977.mp3"). The display name lives separately in demos[].name.
    const path = `approved/${talent.id}/${Date.now()}_${crypto.randomUUID()}.${ext}`;
    const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Could not prepare upload' }, { status: 500 });
    }

    const publicUrl = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ path: data.path, token: data.token, publicUrl });
  } catch (err) {
    return supabaseErrorResponse(err, 'api/talent/demo-upload-url');
  }
}
