import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient, supabaseErrorResponse, storagePathFromRef } from '@/lib/supabase-server';

const BUCKET = 'voice-affidavits';

// Admin-only: mint a short-lived signed URL for a voice-affidavit file
// (audio or signature). Accepts either a bare storage path or a legacy full
// public URL (storagePathFromRef strips everything up to /voice-affidavits/).
export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const raw = new URL(request.url).searchParams.get('u');
  if (!raw) {
    return NextResponse.json({ error: 'Missing file reference' }, { status: 400 });
  }

  const path = storagePathFromRef(raw, BUCKET);
  if (!path) {
    return NextResponse.json({ error: 'Invalid file reference' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 300); // 5-minute link

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: error?.message || 'Could not generate link' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (err) {
    return supabaseErrorResponse(err, 'admin/voice-id/signed-url');
  }
}
