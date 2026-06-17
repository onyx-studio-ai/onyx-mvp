import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = 'voice-affidavits';

// Admin-only: mint a short-lived signed URL for a voice-affidavit file
// (audio or signature). Accepts either a bare storage path or a legacy
// full public URL (we strip everything up to and including /voice-affidavits/).
// Works whether the bucket is public or private, so it can be deployed and
// verified before the bucket is switched to private.
export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Storage is not configured' }, { status: 500 });
  }

  const raw = new URL(request.url).searchParams.get('u');
  if (!raw) {
    return NextResponse.json({ error: 'Missing file reference' }, { status: 400 });
  }

  // Derive the storage path from a stored full public URL or a bare path.
  let path = raw;
  const marker = `/${BUCKET}/`;
  const idx = raw.indexOf(marker);
  if (idx !== -1) path = raw.slice(idx + marker.length);
  try {
    path = decodeURIComponent(path);
  } catch {
    /* keep as-is if not encoded */
  }
  path = path.replace(/^\/+/, '');
  if (!path) {
    return NextResponse.json({ error: 'Invalid file reference' }, { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

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
}
