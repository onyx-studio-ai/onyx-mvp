import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Short-lived signed URL so an admin can play a private liveness recording.
export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path') || '';
  if (!path) return NextResponse.json({ error: 'path is required' }, { status: 400 });

  try {
    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await db.storage.from('liveness').createSignedUrl(path, 600);
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: 'Could not sign URL' }, { status: 500 });
    }
    return NextResponse.json({ url: data.signedUrl });
  } catch (err) {
    console.error('[Liveness] signed-url error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
