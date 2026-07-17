import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { multicastLine, lineConfigured } from '@/lib/line';

/*
  後台 LINE 群發(Wing:推廣文案直接在後台貼上,一鍵發給全部,分客戶/配音員)。
  只發給「綁定過 LINE」的人:
    配音員 = talents.line_user_id;客戶 = line_email_bindings.line_user_id。
  GET  → { talents, clients } 可觸及人數(發送前給 Wing 看規模+估額度)
  POST { audience: 'talents'|'clients'|'both', text } → multicast,回實際送出數。
  ⚠ 每個收到的人算 1 則推播額度(輕用量 200 則/月)。
*/

export const runtime = 'nodejs';
export const maxDuration = 60;

async function gatherIds(audience: string) {
  const db = getSupabaseServiceClient();
  const ids: string[] = [];
  if (audience === 'talents' || audience === 'both') {
    const { data } = await db.from('talents').select('line_user_id').not('line_user_id', 'is', null);
    for (const r of data || []) if (r.line_user_id) ids.push(r.line_user_id as string);
  }
  if (audience === 'clients' || audience === 'both') {
    const { data } = await db.from('line_email_bindings').select('line_user_id').not('line_user_id', 'is', null);
    for (const r of data || []) if (r.line_user_id) ids.push(r.line_user_id as string);
  }
  return [...new Set(ids)];
}

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  if (!lineConfigured()) return NextResponse.json({ configured: false, talents: 0, clients: 0 });
  const [t, c] = await Promise.all([gatherIds('talents'), gatherIds('clients')]);
  return NextResponse.json({ configured: true, talents: t.length, clients: c.length });
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  let b: { audience?: string; text?: string };
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const audience = ['talents', 'clients', 'both'].includes(String(b.audience)) ? String(b.audience) : '';
  const text = String(b.text || '').trim();
  if (!audience || !text) return NextResponse.json({ error: '請選對象並輸入文案' }, { status: 400 });
  if (text.length > 4900) return NextResponse.json({ error: '文案太長(上限 4900 字)' }, { status: 400 });
  const ids = await gatherIds(audience);
  if (!ids.length) return NextResponse.json({ error: '這個對象目前沒有任何人綁定 LINE' }, { status: 404 });
  const sent = await multicastLine(ids, text);
  return NextResponse.json({ ok: true, targeted: ids.length, sent });
}
