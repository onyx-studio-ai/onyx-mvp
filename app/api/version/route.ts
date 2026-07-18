import { NextResponse } from 'next/server';

// 免登入版本探針:回報這個部署的 commit(除錯「使用者到底連到哪個部署」)。
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    sha: (process.env.VERCEL_GIT_COMMIT_SHA || 'unknown').slice(0, 7),
    deployment: process.env.VERCEL_DEPLOYMENT_ID || null,
    at: new Date().toISOString(),
  });
}
