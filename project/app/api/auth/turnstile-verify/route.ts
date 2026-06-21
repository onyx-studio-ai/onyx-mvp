import { NextRequest, NextResponse } from 'next/server';
import { verifyTurnstile } from '@/lib/turnstile';

// Login pre-check: the client verifies the Turnstile token here before calling
// signInWithPassword (which runs on the client and can't be gated server-side
// otherwise). Returns 200 when ok (or when Turnstile isn't configured yet).
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    const ok = await verifyTurnstile(token, ip);
    if (!ok) {
      return NextResponse.json({ error: 'Bot check failed — please try again.' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Bot check failed — please try again.' }, { status: 400 });
  }
}
