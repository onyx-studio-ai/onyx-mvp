import { NextResponse } from 'next/server';
import { listVoices, CosyVoiceError } from '@/lib/voice/cosyvoice-client';

export async function GET() {
  try {
    const voices = await listVoices();
    return NextResponse.json({ voices });
  } catch (err) {
    const status = err instanceof CosyVoiceError && err.status ? err.status : 502;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error', voices: [] },
      { status },
    );
  }
}
