import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ ping: 'pong', sha: (process.env.VERCEL_GIT_COMMIT_SHA || 'unknown').slice(0, 7) });
}
