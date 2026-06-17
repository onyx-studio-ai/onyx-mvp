import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = 'talent-submissions';
const ALLOWED_EXT = ['wav', 'wave', 'mp3', 'm4a', 'aac', 'ogg', 'flac'];

// Public (apply form): mint a one-time signed UPLOAD url so applicants can
// upload their demo directly to storage WITHOUT the bucket allowing anon
// writes. The signed token (created by service_role) authorizes this single
// upload; the bucket can then be private + anon-insert policy removed.
export async function POST(request: NextRequest) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Upload service is not configured' }, { status: 500 });
  }

  let body: { fileName?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const fileName = (body.fileName || '').trim();
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (!ext || !ALLOWED_EXT.includes(ext)) {
    return NextResponse.json(
      { error: 'Only audio files (wav, mp3, m4a, aac, ogg, flac) are accepted' },
      { status: 400 }
    );
  }

  const folder = body.role === 'Singer' ? 'singers' : 'voice-actors';
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
  const path = `${folder}/${Date.now()}_${safeName}`;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || 'Could not prepare upload' },
      { status: 500 }
    );
  }

  // Client uploads with supabase.storage.from(BUCKET).uploadToSignedUrl(path, token, file)
  return NextResponse.json({ path: data.path, token: data.token });
}
