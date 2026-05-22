import { NextResponse } from 'next/server';
import { getHealth, CosyVoiceError } from '@/lib/voice/cosyvoice-client';

export async function GET() {
  try {
    const info = await getHealth();
    return NextResponse.json(info);
  } catch (err) {
    const status = err instanceof CosyVoiceError && err.status ? err.status : 502;
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Unknown error',
        cosyvoice_reachable: false,
      },
      { status },
    );
  }
}
