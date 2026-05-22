import { NextRequest, NextResponse } from 'next/server';
import { uploadReference, CosyVoiceError } from '@/lib/voice/cosyvoice-client';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';

// Admin-only endpoint — uploading a reference voice to the CosyVoice server
// effectively adds a new "voice" to the platform. Customers can't do this.
export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const formData = await request.formData();
    const voiceId = formData.get('voice_id');
    const transcript = formData.get('transcript');
    const audioFile = formData.get('audio');

    if (typeof voiceId !== 'string' || !voiceId.trim()) {
      return NextResponse.json({ error: 'voice_id is required' }, { status: 400 });
    }
    if (typeof transcript !== 'string' || !transcript.trim()) {
      return NextResponse.json({ error: 'transcript is required' }, { status: 400 });
    }
    if (!(audioFile instanceof Blob)) {
      return NextResponse.json({ error: 'audio file is required' }, { status: 400 });
    }

    const filename = audioFile instanceof File ? audioFile.name : 'reference.wav';

    const result = await uploadReference({
      voiceId: voiceId.trim(),
      transcript: transcript.trim(),
      audioFile,
      audioFilename: filename,
    });

    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof CosyVoiceError && err.status ? err.status : 500;
    console.error('[CosyVoice Upload] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status },
    );
  }
}

// Increase body size limit for audio file uploads (default 4 MB is too small
// for the 30+ second wav references CosyVoice 2 PVCs usually expect).
export const maxDuration = 120;
export const dynamic = 'force-dynamic';
