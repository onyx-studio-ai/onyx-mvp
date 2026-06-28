import { NextRequest, NextResponse } from 'next/server';
import { resolveTalentFromRequest } from '@/lib/talent-auth';

const BUCKET = 'casting';
const ALLOWED_EXT = ['wav', 'wave', 'mp3', 'm4a', 'aac', 'ogg', 'flac', 'zip'];

/*
  POST /api/talent/delivery-upload — mint a one-time signed UPLOAD url so a talent
  whose audition was ACCEPTED can hand in the finished recording directly to the
  `casting` bucket (separate `deliveries/` prefix from auditions). Allows zip too,
  since a finished job can be a bundle of takes/files.

  Returns { path, token, publicUrl }. Client uploads with uploadToSignedUrl, then
  PATCHes /api/talent/quotes { id, delivery_url } to attach it to the accepted quote.
*/
export async function POST(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const talent = r.talent as { id: string };

  let body: { fileName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const ext = ((body.fileName || '').split('.').pop() || '').toLowerCase();
  if (!ext || !ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ error: 'Only audio files (wav, mp3, m4a, aac, ogg, flac) or zip are accepted' }, { status: 400 });
  }

  const path = `deliveries/${talent.id}/${Date.now()}_${crypto.randomUUID()}.${ext}`;
  const { data, error } = await r.db.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Could not prepare upload' }, { status: 500 });
  }
  // .trim() guards against a trailing newline on the env var, which would otherwise
  // land inside the URL (…supabase.co\n/storage/…) and break the link.
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
  return NextResponse.json({ path: data.path, token: data.token, publicUrl: `${base}/storage/v1/object/public/${BUCKET}/${data.path}` });
}
