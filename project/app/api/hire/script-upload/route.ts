import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient, supabaseErrorResponse } from '@/lib/supabase-server';

const BUCKET = 'casting';
// Documents the client attaches to a brief: the script, or the filled role sheet
// (xlsx/csv). Documents/spreadsheets only — not audio.
const ALLOWED_EXT = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'pages', 'md', 'xlsx', 'xls', 'csv'];

/*
  POST /api/hire/script-upload — public: mint a one-time signed UPLOAD url so a
  client posting a brief can attach a script file directly to storage WITHOUT the
  bucket allowing anon writes (service-role-signed token authorises one upload).

  Returns { path, token, publicUrl }. Client uploads with
  supabase.storage.from('casting').uploadToSignedUrl(path, token, file), then
  submits publicUrl as the brief's script_file_url.
*/
export async function POST(request: NextRequest) {
  let body: { fileName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const ext = ((body.fileName || '').split('.').pop() || '').toLowerCase();
  if (!ext || !ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ error: 'Only document files (pdf, doc, docx, txt, rtf, odt, pages, md) are accepted' }, { status: 400 });
  }

  // Opaque path — original name can carry PII that would leak in the URL.
  const path = `client-scripts/${Date.now()}_${crypto.randomUUID()}.${ext}`;
  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Could not prepare upload' }, { status: 500 });
    }
    const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, ''); // .trim() = guard against a trailing newline on the env var
    return NextResponse.json({ path: data.path, token: data.token, publicUrl: `${base}/storage/v1/object/public/${BUCKET}/${data.path}` });
  } catch (err) {
    return supabaseErrorResponse(err, 'hire/script-upload');
  }
}
