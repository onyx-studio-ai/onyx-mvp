import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { auditionDeadlinePassed } from '@/lib/casting';

/*
  Public self-serve casting join (no login, no admin). The casting call's id is a
  shareable "join" token — paste the link anywhere (WeChat/LINE). A visitor opens
  it, enters their email + name, and we mint (or reuse) a personal casting_invite
  for them, then hand back its token so they continue on the normal guest page
  (/casting/<token>) — audition without registering, return anytime, upgrade later.

    GET  /api/casting/join?id=<brief_id> — minimal brief info for the landing page.
    POST /api/casting/join { brief_id, email, name } — returns { token }.
*/
const EMAILRE = /^[\w.%+-]+@[\w.-]+\.[a-z]{2,}$/i;

// 試音是否已截止 = 案件非 open,或過了 audition_deadline||deadline(當天 23:59)。
// 沒設 / parse 失敗一律不算截止(與登入端 / briefs API / [token] 端同一套規則)。
function castingClosed(brief: { status?: string | null; audition_deadline?: string | null; deadline?: string | null; created_at?: string | null }): boolean {
  if (brief.status !== 'open') return true;
  return auditionDeadlinePassed(brief);
}

async function loadCasting(briefId: string) {
  const db = getSupabaseServiceClient();
  const { data } = await db
    .from('marketplace_briefs')
    .select('id, title, language, rate_note, kind, status, audition_deadline, deadline, ai_type, created_at')
    .eq('id', briefId)
    .maybeSingle();
  return { db, brief: data && data.kind === 'casting' ? data : null };
}

export async function GET(request: NextRequest) {
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const { brief } = await loadCasting(id);
  if (!brief) return NextResponse.json({ error: 'invalid' }, { status: 404 });
  return NextResponse.json({
    title: brief.title, language: brief.language, rate_note: brief.rate_note,
    ai_type: brief.ai_type, closed: castingClosed(brief),
  });
}

export async function POST(request: NextRequest) {
  let b: { brief_id?: string; email?: string; name?: string };
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const briefId = String(b.brief_id || '');
  const email = String(b.email || '').trim().toLowerCase();
  const name = String(b.name || '').trim().slice(0, 80);
  if (!briefId) return NextResponse.json({ error: 'brief_id is required' }, { status: 400 });
  if (!EMAILRE.test(email)) return NextResponse.json({ error: '請填寫有效的 email' }, { status: 400 });

  const { db, brief } = await loadCasting(briefId);
  if (!brief) return NextResponse.json({ error: '找不到這個試音案' }, { status: 404 });
  if (castingClosed(brief)) return NextResponse.json({ error: '這個試音案已結束或已截止' }, { status: 400 });

  // Reuse an existing invite for this person (one stable personal link), else mint one.
  const { data: existing } = await db.from('casting_invites').select('token').eq('brief_id', briefId).eq('email', email).maybeSingle();
  if (existing?.token) return NextResponse.json({ token: existing.token });

  const token = crypto.randomBytes(24).toString('hex');
  const { error } = await db.from('casting_invites').insert({ brief_id: briefId, email, name: name || null, token });
  if (error) {
    // Possible race (unique brief+email) — re-read and return the winner's token.
    const { data: again } = await db.from('casting_invites').select('token').eq('brief_id', briefId).eq('email', email).maybeSingle();
    if (again?.token) return NextResponse.json({ token: again.token });
    return NextResponse.json({ error: '建立試音連結失敗' }, { status: 500 });
  }
  return NextResponse.json({ token });
}
