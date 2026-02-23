import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function getSupabaseClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function sanitizePath(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9._\-/]/g, '_');
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const orderId = formData.get('orderId') as string | null;

    if (!file || !orderId) {
      return NextResponse.json({ error: 'Missing file or orderId' }, { status: 400 });
    }

    const db = getSupabaseClient();

    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    const safeName = sanitizePath(file.name);
    const filePath = `orchestra/${orderId}/${Date.now()}-${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: storageError } = await db.storage
      .from('deliverables')
      .upload(filePath, buffer, {
        contentType: 'application/octet-stream',
        upsert: true,
      });

    if (storageError) {
      console.error('Orchestra file upload error:', storageError);
      return NextResponse.json({ error: storageError.message }, { status: 500 });
    }

    const { data: urlData } = db.storage.from('deliverables').getPublicUrl(filePath);
    const fileUrl = urlData.publicUrl;

    const isMidiOrAudio = ['.mid', '.midi', '.wav', '.mp3', '.aac', '.flac'].includes(ext);
    const updateField = isMidiOrAudio
      ? { midi_file_url: fileUrl }
      : { score_file_url: fileUrl };

    const { error: updateError } = await db
      .from('orchestra_orders')
      .update({ ...updateField, status: 'under_review' })
      .eq('id', orderId);

    if (updateError) {
      console.error('Orchestra order update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ url: fileUrl, field: isMidiOrAudio ? 'midi_file_url' : 'score_file_url' });
  } catch (err) {
    console.error('Orchestra upload API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
