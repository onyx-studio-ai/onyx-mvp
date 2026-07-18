import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  後台訊息中心(Wing 2026-07-16:對話散在各案的 💬 裡,不點進去不知道誰回了)。
  GET  → 全部對話串:每串最後一則 + 案名 + 配音員名 + 未讀(對方新訊 > 已讀時間)。
  POST { thread_key } → 標記已讀(admin_thread_reads upsert)。
  thread_key = `${brief_id}:${talent_id}`。
*/

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const db = getSupabaseServiceClient();

  // 訊息量小(每案×每人一串),直接掃最近 2000 則彙整;未來量大再分頁。
  const { data: msgs } = await db.from('marketplace_messages')
    .select('brief_id, talent_id, sender_type, sender_name, body, created_at')
    .order('created_at', { ascending: false }).limit(2000);
  const threads = new Map<string, { brief_id: string; talent_id: string; last_body: string; last_at: string; last_sender: string; last_sender_name: string; count: number; blob: string }>();
  for (const m of msgs || []) {
    const key = `${m.brief_id || 'direct'}:${m.talent_id}`;
    const t = threads.get(key);
    if (t) { t.count += 1; if (t.blob.length < 3000) t.blob += '\n' + String(m.body || '').slice(0, 300); continue; }   // 已有最後一則(desc 排序,首見即最新)
    threads.set(key, { brief_id: m.brief_id ? String(m.brief_id) : 'direct', talent_id: String(m.talent_id), last_body: String(m.body || ''), last_at: String(m.created_at), last_sender: String(m.sender_type), last_sender_name: String(m.sender_name || ''), count: 1, blob: String(m.body || '').slice(0, 300) });
  }

  const { data: reads } = await db.from('admin_thread_reads').select('thread_key, read_at');
  const readAt = new Map((reads || []).map((r) => [String(r.thread_key), String(r.read_at)]));

  const briefIds = [...new Set([...threads.values()].map((t) => t.brief_id))];
  const talentIds = [...new Set([...threads.values()].map((t) => t.talent_id))];
  const [{ data: briefs }, { data: talents }] = await Promise.all([
    briefIds.length ? db.from('marketplace_briefs').select('id, title, brief_number').in('id', briefIds) : Promise.resolve({ data: [] as { id: string; title?: string; brief_number?: string }[] }),
    talentIds.length ? db.from('talents').select('id, name').in('id', talentIds) : Promise.resolve({ data: [] as { id: string; name?: string }[] }),
  ]);
  const briefById = new Map((briefs || []).map((b) => [String(b.id), b]));
  const talentById = new Map((talents || []).map((t) => [String(t.id), t]));

  const list = [...threads.entries()].map(([key, t]) => ({
    thread_key: key,
    ...t,
    blob: t.blob,
    brief_title: t.brief_id === 'direct' ? '平台直訊' : (briefById.get(t.brief_id)?.title || '(案件)'),
    brief_number: t.brief_id === 'direct' ? 'ONYX' : (briefById.get(t.brief_id)?.brief_number || ''),
    talent_name: talentById.get(t.talent_id)?.name || '(配音員)',
    // 未讀 = 最後一則不是我們發的,且晚於已讀時間
    unread: t.last_sender !== 'admin' && (!readAt.has(key) || t.last_at > readAt.get(key)!),
  })).sort((a, b) => b.last_at.localeCompare(a.last_at));

  return NextResponse.json({ threads: list, unread: list.filter((t) => t.unread).length });
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  let body: { thread_key?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const key = String(body.thread_key || '').trim();
  if (!key) return NextResponse.json({ error: 'missing thread_key' }, { status: 400 });
  const db = getSupabaseServiceClient();
  const { error } = await db.from('admin_thread_reads').upsert({ thread_key: key, read_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
