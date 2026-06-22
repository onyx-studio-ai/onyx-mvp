import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient, supabaseErrorResponse } from '@/lib/supabase-server';

/*
  Talent self-service headshot upload. Auth'd by the talent's own session. Mints a
  one-time signed UPLOAD url into the PUBLIC talent-photos bucket, scoped to
  <their-talent-id>/. The browser crops + compresses the image to a small square
  JPEG BEFORE upload, so only one tight file lands; it then PATCHes headshot_url
  on /api/talent/me with the returned publicUrl.
*/

const BUCKET = 'talent-photos';

export async function POST(request: NextRequest) {
  try {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const db = getSupabaseServiceClient();
    const { data: userData, error: userErr } = await db.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });

    let { data: talent } = await db.from('talents').select('id').eq('auth_user_id', user.id).maybeSingle();
    if (!talent && user.email) {
      const { data: byEmail } = await db.from('talents').select('id').eq('email', user.email).maybeSingle();
      if (byEmail) talent = byEmail;
    }
    if (!talent) return NextResponse.json({ error: 'No talent profile for this account' }, { status: 404 });

    // Always a JPEG (the client compresses to JPEG). One stable-ish path per
    // upload; the cache-busting timestamp keeps the public URL fresh on replace.
    const path = `${talent.id}/${Date.now()}.jpg`;
    const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) return NextResponse.json({ error: error?.message || 'Could not prepare upload' }, { status: 500 });

    const publicUrl = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ path: data.path, token: data.token, publicUrl });
  } catch (err) {
    return supabaseErrorResponse(err, 'api/talent/photo-upload-url');
  }
}
