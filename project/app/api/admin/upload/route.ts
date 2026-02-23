import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hnblwckpnapsdladcjql.supabase.co';

function getServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { path } = body;
      if (!path) {
        return NextResponse.json({ error: 'Missing path' }, { status: 400 });
      }
      const db = getServiceClient();
      const { data, error } = await db.storage.from('deliverables').createSignedUploadUrl(path);
      if (error || !data) {
        return NextResponse.json({ error: error?.message || 'Failed to create signed URL' }, { status: 500 });
      }
      const publicUrl = db.storage.from('deliverables').getPublicUrl(path).data.publicUrl;
      return NextResponse.json({ signedUrl: data.signedUrl, token: data.token, publicUrl });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const path = formData.get('path') as string | null;

    if (!file || !path) {
      return NextResponse.json({ error: 'Missing file or path' }, { status: 400 });
    }

    const db = getServiceClient();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error } = await db.storage.from('deliverables').upload(path, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: true,
    });

    if (error) {
      console.error('Storage upload error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: urlData } = db.storage.from('deliverables').getPublicUrl(path);
    return NextResponse.json({ success: true, publicUrl: urlData.publicUrl });
  } catch (err) {
    console.error('Upload API error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
