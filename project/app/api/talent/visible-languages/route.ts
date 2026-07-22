import { NextRequest, NextResponse } from 'next/server';
import { resolveTalentFromRequest } from '@/lib/talent-auth';
import { normalizeLangArray } from '@/lib/languages';

/*
  POST /api/talent/visible-languages { languages: string[] } — 配音員自選「想看的
  案件語言」(最多 5,平台標準值)。獨立端點,刻意不走 /api/talent/me 的 PUT ——
  那條路掛著草稿/重審機制,改個偏好不該把已發布的檔案翻成待審。(Wing 2026-07-22)
  空陣列 = 清除自選,回落到檔案 languages。
*/
export async function POST(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

  let body: { languages?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const langs = normalizeLangArray(Array.isArray(body.languages) ? body.languages : []).slice(0, 5);

  const { error } = await r.db.from('talents')
    .update({ visible_languages: langs.length ? langs : null })
    .eq('id', (r.talent as { id: string }).id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, languages: langs });
}
