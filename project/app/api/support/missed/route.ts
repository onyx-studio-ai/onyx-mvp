import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  客服泡泡漏答收集(公開、fire-and-forget):Aria 本地比對答不出時記一筆,
  Wing 滾動式補 FAQ 用。永遠回 204,失敗只留 server log 不擋前端。
*/
export async function POST(request: NextRequest) {
  try {
    const b = await request.json();
    const query = String(b.query || '').trim().slice(0, 300);
    if (!query) return new NextResponse(null, { status: 204 });
    const db = getSupabaseServiceClient();
    const { error } = await db.from('support_missed_questions').insert({
      query,
      locale: String(b.locale || '').slice(0, 10) || null,
      top_match: String(b.top_match || '').slice(0, 200) || null,
      score: Number.isFinite(Number(b.score)) ? Number(b.score) : null,
    });
    if (error) console.error('[support-missed]', error.message);
  } catch { /* 靜默 */ }
  return new NextResponse(null, { status: 204 });
}
