import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  後台公開徵集投稿(Wing 2026-08-07):GET 列全部投稿;PATCH 改狀態/內部備註。
  demo 在公開 casting bucket(opencall/ 亂數路徑),直接用 public URL 播放。
*/
export async function GET(request: NextRequest) {
  const unauth = requireAdmin(request);
  if (unauth) return unauth;
  const db = getSupabaseServiceClient();
  const { data, error } = await db.from('opencall_submissions')
    .select('*').order('created_at', { ascending: false }).limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

export async function PATCH(request: NextRequest) {
  const unauth = requireAdmin(request);
  if (unauth) return unauth;
  let b: { id?: string; status?: string; admin_note?: string };
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  if (!b.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const updates: Record<string, unknown> = {};
  if (b.status && ['new', 'shortlisted', 'picked', 'passed'].includes(b.status)) updates.status = b.status;
  if (typeof b.admin_note === 'string') updates.admin_note = b.admin_note.slice(0, 500);
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  const db = getSupabaseServiceClient();
  const { error } = await db.from('opencall_submissions').update(updates).eq('id', b.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
