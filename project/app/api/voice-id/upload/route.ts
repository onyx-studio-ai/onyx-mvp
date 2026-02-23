import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getServiceClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { data: talent, error } = await supabase
      .from('talents')
      .select('id, name, voice_id_status, voice_id_token_expires')
      .eq('voice_id_token', token)
      .single();

    if (error || !talent) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
    }

    if (talent.voice_id_status === 'submitted' || talent.voice_id_status === 'verified') {
      return NextResponse.json({ error: 'Voice ID already submitted' }, { status: 400 });
    }

    if (talent.voice_id_token_expires && new Date(talent.voice_id_token_expires) < new Date()) {
      return NextResponse.json({ error: 'Token has expired' }, { status: 410 });
    }

    return NextResponse.json({
      valid: true,
      talentName: talent.name,
    });
  } catch (err) {
    console.error('[Voice ID Upload] Validate error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const token = formData.get('token') as string;
    const file = formData.get('file') as File;
    const signatureDataUrl = formData.get('signature') as string | null;
    const paymentMethod = formData.get('payment_method') as string | null;
    const paymentDetailsStr = formData.get('payment_details') as string | null;

    if (!token || !file) {
      return NextResponse.json({ error: 'Token and file are required' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 });
    }

    const allowedTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/x-wav', 'audio/wave'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Only WAV or MP3 files are accepted' }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { data: talent, error: fetchErr } = await supabase
      .from('talents')
      .select('id, name, voice_id_status, voice_id_token_expires, voice_id_number')
      .eq('voice_id_token', token)
      .single();

    if (fetchErr || !talent) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
    }

    if (talent.voice_id_status === 'submitted' || talent.voice_id_status === 'verified') {
      return NextResponse.json({ error: 'Voice ID already submitted' }, { status: 400 });
    }

    if (talent.voice_id_token_expires && new Date(talent.voice_id_token_expires) < new Date()) {
      return NextResponse.json({ error: 'Token has expired' }, { status: 410 });
    }

    const ext = file.name.split('.').pop() || 'wav';
    const storagePath = `${talent.voice_id_number || talent.id}/${Date.now()}_voice-id.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('voice-affidavits')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) {
      console.error('[Voice ID Upload] Storage error:', uploadErr);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from('voice-affidavits')
      .getPublicUrl(uploadData.path);

    let signatureUrl: string | null = null;
    if (signatureDataUrl) {
      try {
        const base64Data = signatureDataUrl.replace(/^data:image\/png;base64,/, '');
        const sigBuffer = Buffer.from(base64Data, 'base64');
        const sigPath = `${talent.voice_id_number || talent.id}/${Date.now()}_signature.png`;

        const { data: sigUpload, error: sigErr } = await supabase.storage
          .from('voice-affidavits')
          .upload(sigPath, sigBuffer, { contentType: 'image/png', upsert: false });

        if (!sigErr && sigUpload) {
          const { data: sigUrlData } = supabase.storage
            .from('voice-affidavits')
            .getPublicUrl(sigUpload.path);
          signatureUrl = sigUrlData.publicUrl;
        }
      } catch (sigError) {
        console.error('[Voice ID Upload] Signature upload error:', sigError);
      }
    }

    const updatePayload: Record<string, unknown> = {
      voice_id_status: 'submitted',
      voice_id_file_url: urlData.publicUrl,
      voice_id_submitted_at: new Date().toISOString(),
      voice_id_token: null,
      voice_id_token_expires: null,
    };
    if (signatureUrl) {
      updatePayload.voice_id_signature_url = signatureUrl;
    }
    if (paymentMethod) {
      updatePayload.payment_method = paymentMethod;
      try {
        updatePayload.payment_details = paymentDetailsStr ? JSON.parse(paymentDetailsStr) : null;
      } catch {
        updatePayload.payment_details = null;
      }
    }

    const { error: updateErr } = await supabase
      .from('talents')
      .update(updatePayload)
      .eq('id', talent.id);

    if (updateErr) {
      console.error('[Voice ID Upload] Update error:', updateErr);
      return NextResponse.json({ error: 'Failed to update record' }, { status: 500 });
    }

    return NextResponse.json({ success: true, vidNumber: talent.voice_id_number });
  } catch (err) {
    console.error('[Voice ID Upload] Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
