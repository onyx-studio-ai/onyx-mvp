import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';

/*
  AI 生成用量報表(Phase 1 計帳地基,2026-07-18)。
  GET → 本月彙總(依聲音分組:次數/字數/成本)+ 最近 50 筆明細。
  分潤地基:配音員 25% / 平台 75%(Wing 2026-07-18 拍板)—— 分潤金額等定價定案後
  以「營收」計,這裡先讓每一筆生成有跡可查。
*/
export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const db = getSupabaseServiceClient();
  const monthStart = new Date();
  monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);

  const { data: rows } = await db
    .from('ai_generations')
    .select('voice_key, language, chars, engine, purpose, cost_usd, created_at')
    .gte('created_at', monthStart.toISOString())
    .order('created_at', { ascending: false })
    .limit(2000);

  const byVoice = new Map<string, { count: number; chars: number; cost: number }>();
  for (const r of rows || []) {
    const k = r.voice_key || 'unknown';
    const v = byVoice.get(k) || { count: 0, chars: 0, cost: 0 };
    v.count += 1; v.chars += r.chars || 0; v.cost += Number(r.cost_usd) || 0;
    byVoice.set(k, v);
  }
  return NextResponse.json({
    month: monthStart.toISOString().slice(0, 7),
    total: {
      count: (rows || []).length,
      chars: (rows || []).reduce((a, r) => a + (r.chars || 0), 0),
      cost_usd: Math.round((rows || []).reduce((a, r) => a + (Number(r.cost_usd) || 0), 0) * 100000) / 100000,
    },
    by_voice: [...byVoice.entries()].map(([voice_key, v]) => ({ voice_key, ...v, cost: Math.round(v.cost * 100000) / 100000 }))
      .sort((a, b) => b.chars - a.chars),
    recent: (rows || []).slice(0, 50),
  });
}
