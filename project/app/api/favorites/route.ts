import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  Client shortlist (收藏配音員). A logged-in user favorites talents to compare/hire
  later. Authenticated by the caller's Supabase token (the table itself is
  RLS-locked; only this service-role route reads/writes it).
    GET            → { ids:[talentId], items:[talent card] } (newest first)
    POST  {talent_id}
    DELETE ?talent_id=
*/

const TALENT_CARD = 'id, name, english_name, headshot_url, sample_url, category, languages, accent, gender, voice_traits, specialties, is_active';

async function userFrom(request: NextRequest) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const db = getSupabaseServiceClient();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return null;
  return { db, userId: data.user.id };
}

export async function GET(request: NextRequest) {
  const c = await userFrom(request);
  if (!c) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { data: favs } = await c.db.from('talent_favorites').select('talent_id, created_at').eq('user_id', c.userId).order('created_at', { ascending: false });
  const ids = (favs || []).map((f) => f.talent_id as string);
  if (!ids.length) return NextResponse.json({ ids: [], items: [] });
  const { data: talents } = await c.db.from('talents').select(TALENT_CARD).in('id', ids).eq('is_active', true);
  const byId = new Map((talents || []).map((t) => [t.id as string, t]));
  const items = ids.map((id) => byId.get(id)).filter(Boolean); // preserve favorite (newest-first) order, drop unpublished
  return NextResponse.json({ ids, items });
}

export async function POST(request: NextRequest) {
  const c = await userFrom(request);
  if (!c) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  let body: { talent_id?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const talentId = String(body.talent_id || '');
  if (!talentId) return NextResponse.json({ error: 'talent_id required' }, { status: 400 });
  const { error } = await c.db.from('talent_favorites').upsert({ user_id: c.userId, talent_id: talentId }, { onConflict: 'user_id,talent_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const c = await userFrom(request);
  if (!c) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const talentId = new URL(request.url).searchParams.get('talent_id') || '';
  if (!talentId) return NextResponse.json({ error: 'talent_id required' }, { status: 400 });
  const { error } = await c.db.from('talent_favorites').delete().eq('user_id', c.userId).eq('talent_id', talentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
