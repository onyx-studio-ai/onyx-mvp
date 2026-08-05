import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  潛在名單(prospects)後台管理 —— 讓 Wing 看得到、控制得了這份線索池。
  GET   ?q=&kind=&status=&source=&limit=&offset=  → 篩選清單 + 各狀態/類型計數 + 每筆邀請次數
  PATCH { id, status? , note? }                    → 改狀態(active/suppressed/joined)或備註
  POST  { email, name?, kind?, company?, country?, languages?, note? } → 手動加一筆(upsert on email)
  DELETE ?id=                                        → 刪一筆(誤加時用)
  資料本身(往來紀錄=note)來自 Wing 的 Excel,非臆測;狀態 suppressed=永不寄。
*/

const KINDS = ['talent', 'client', 'proofreader'];
const STATUSES = ['active', 'suppressed', 'joined'];

export async function GET(request: NextRequest) {
  const unauth = requireAdmin(request);
  if (unauth) return unauth;
  const db = getSupabaseServiceClient();
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const kind = searchParams.get('kind') || '';
  const status = searchParams.get('status') || '';
  const source = searchParams.get('source') || '';
  const limit = Math.min(Number(searchParams.get('limit')) || 200, 1000);
  const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

  let query = db.from('prospects')
    .select('id, email, name, kind, company, country, gender, languages, note, source, status, last_invited_at, created_at', { count: 'exact' });
  if (kind && KINDS.includes(kind)) query = query.eq('kind', kind);
  if (status && STATUSES.includes(status)) query = query.eq('status', status);
  if (source) query = query.eq('source', source);
  if (q) query = query.or(`email.ilike.%${q}%,name.ilike.%${q}%,company.ilike.%${q}%,note.ilike.%${q}%`);
  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = data || [];

  // 每筆的邀請次數(這頁的人)——讓 Wing 看得到「寄過幾次」。
  const ids = rows.map((r) => r.id as string);
  const inviteCount: Record<string, number> = {};
  if (ids.length) {
    const { data: inv } = await db.from('prospect_invites').select('prospect_id').in('prospect_id', ids);
    for (const i of inv || []) inviteCount[i.prospect_id as string] = (inviteCount[i.prospect_id as string] || 0) + 1;
  }
  const prospects = rows.map((r) => ({ ...r, invite_count: inviteCount[r.id as string] || 0 }));

  // 全庫計數(不受篩選影響)——頂部統計用。
  const counts: Record<string, number> = {};
  for (const k of ['all', ...KINDS, ...STATUSES]) counts[k] = 0;
  const { data: allRows } = await db.from('prospects').select('kind, status');
  for (const r of allRows || []) {
    counts.all++;
    if (r.kind) counts[r.kind as string] = (counts[r.kind as string] || 0) + 1;
    if (r.status) counts[r.status as string] = (counts[r.status as string] || 0) + 1;
  }

  return NextResponse.json({ prospects, total: count ?? prospects.length, counts });
}

export async function PATCH(request: NextRequest) {
  const unauth = requireAdmin(request);
  if (unauth) return unauth;
  let b: { id?: string; status?: string; note?: string };
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  const id = String(b.id || '');
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) return NextResponse.json({ error: 'bad status' }, { status: 400 });
    patch.status = b.status;
  }
  if (b.note !== undefined) patch.note = String(b.note).slice(0, 2000);
  const db = getSupabaseServiceClient();
  const { error } = await db.from('prospects').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const unauth = requireAdmin(request);
  if (unauth) return unauth;
  let b: { email?: string; name?: string; kind?: string; company?: string; country?: string; languages?: string[]; note?: string };
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  const email = String(b.email || '').trim().toLowerCase();
  if (!/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(email)) return NextResponse.json({ error: 'email 格式不對' }, { status: 400 });
  const kind = KINDS.includes(String(b.kind)) ? String(b.kind) : 'talent';
  const row = {
    email, name: (b.name || '').trim() || null, kind, company: (b.company || '').trim() || null,
    country: (b.country || '').trim() || null,
    languages: Array.isArray(b.languages) ? b.languages : [],
    note: (b.note || '').trim() || null, source: 'manual',
  };
  const db = getSupabaseServiceClient();
  // upsert on email:手動加已存在的人 → 合併不重複(status 不動,不洗掉 suppressed/joined)。
  const { error } = await db.from('prospects').upsert(row, { onConflict: 'email' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const unauth = requireAdmin(request);
  if (unauth) return unauth;
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
  const db = getSupabaseServiceClient();
  const { error } = await db.from('prospects').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
