import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  POST /api/casting/[token]/upload — guest audition upload. The invite token
  authorizes a one-time signed upload to the `casting` bucket (bucket stays closed
  to anon writes). Returns { path, token, publicUrl }.
*/
const BUCKET = 'casting';
const ALLOWED_EXT = ['wav', 'wave', 'mp3', 'm4a', 'aac', 'ogg', 'flac'];

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = getSupabaseServiceClient();
  const { data: invite } = await db.from('casting_invites').select('id').eq('token', token).maybeSingle();
  if (!invite) return NextResponse.json({ error: 'invalid' }, { status: 404 });

  let b: { fileName?: string };
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  const ext = ((b.fileName || '').split('.').pop() || '').toLowerCase();
  if (!ext || !ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ error: 'Only audio files (wav, mp3, m4a, aac, ogg, flac) are accepted' }, { status: 400 });
  }
  const path = `auditions/guest/${invite.id}/${Date.now()}_${crypto.randomUUID()}.${ext}`;
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ error: error?.message || 'Could not prepare upload' }, { status: 500 });
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, ''); // .trim() = guard against a trailing newline on the env var
  return NextResponse.json({ path: data.path, token: data.token, publicUrl: `${base}/storage/v1/object/public/${BUCKET}/${data.path}` });
}
