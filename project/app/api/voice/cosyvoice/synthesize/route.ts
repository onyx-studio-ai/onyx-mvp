import { NextRequest, NextResponse } from 'next/server';
import { synthesize, CosyVoiceError } from '@/lib/voice/cosyvoice-client';

// Simple in-memory rate limiter to prevent free-tier abuse. Resets every
// minute. Production should swap for Upstash Redis or similar, but this is
// the right safety net until we have real traffic.
const RATE_LIMIT_PER_MINUTE = 20;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_PER_MINUTE) return false;
  bucket.count++;
  return true;
}

// Soft cap on length for unauthenticated requests — avoids someone pasting a
// 10k-character novel and burning GPU time. Authenticated/paid users can be
// raised later via a header check.
const MAX_TEXT_LENGTH = 500;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, voiceId, instruction } = body as {
      text?: string;
      voiceId?: string;
      instruction?: string;
    };

    if (!text || !voiceId) {
      return NextResponse.json(
        { error: 'Missing required fields: text, voiceId' },
        { status: 400 },
      );
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        {
          error: `Text too long (${text.length} chars, max ${MAX_TEXT_LENGTH} for preview). Sign up for a paid plan to lift the limit.`,
        },
        { status: 413 },
      );
    }

    // Rate limit by IP. Cloudflare / Vercel sets x-forwarded-for.
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: `Rate limit: max ${RATE_LIMIT_PER_MINUTE} requests per minute` },
        { status: 429 },
      );
    }

    const audioBuffer = await synthesize({ text, voiceId, instruction });

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    const status = err instanceof CosyVoiceError && err.status ? err.status : 500;
    console.error('[CosyVoice Synthesize] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Synthesis failed' },
      { status },
    );
  }
}
