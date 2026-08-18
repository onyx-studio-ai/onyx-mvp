import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient, supabaseErrorResponse } from '@/lib/supabase-server';

const BUCKET = 'talent-submissions';
const ALLOWED_EXT = ['wav', 'wave', 'mp3', 'm4a', 'aac', 'ogg', 'flac'];
// 大頭照(2026-08-17 補:申請表原本沒收頭像,每個核准的人都要事後補才上得了架)
const PHOTO_EXT = ['jpg', 'jpeg', 'png', 'webp'];

// Public (apply form): mint a one-time signed UPLOAD url so applicants can
// upload their demo directly to storage WITHOUT the bucket allowing anon
// writes. The signed token (created by service_role) authorizes this single
// upload; the bucket can then be private + anon-insert policy removed.
export async function POST(request: NextRequest) {
  let body: { fileName?: string; role?: string; kind?: 'demo' | 'photo' };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const isPhoto = body.kind === 'photo';
  const fileName = (body.fileName || '').trim();
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const allowed = isPhoto ? PHOTO_EXT : ALLOWED_EXT;
  if (!ext || !allowed.includes(ext)) {
    return NextResponse.json(
      { error: isPhoto ? 'Only images (jpg, png, webp) are accepted' : 'Only audio files (wav, mp3, m4a, aac, ogg, flac) are accepted' },
      { status: 400 }
    );
  }

  const folder = isPhoto ? 'headshots' : body.role === 'Singer' ? 'singers' : 'voice-actors';
  // Opaque filename — the original can carry a phone/PII that would leak in the URL.
  const path = `${folder}/${Date.now()}_${crypto.randomUUID()}.${ext}`;

  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || 'Could not prepare upload' },
        { status: 500 }
      );
    }
    // Client uploads with supabase.storage.from(BUCKET).uploadToSignedUrl(path, token, file)
    return NextResponse.json({ path: data.path, token: data.token });
  } catch (err) {
    return supabaseErrorResponse(err, 'apply/upload-url');
  }
}
