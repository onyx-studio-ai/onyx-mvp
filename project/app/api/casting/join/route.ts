import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { auditionDeadlinePassed } from '@/lib/casting';

/*
  Casting join (the shareable "join" link, id = brief_id — paste anywhere).

    GET  /api/casting/join?id=<brief_id> — minimal brief info for the landing page.
    POST /api/casting/join { brief_id, name? } — REQUIRES a logged-in session
         (Bearer token). Mints/reuses this person's casting_invite, LINKED to their
         talent profile, and returns { token } to continue on /casting/<token>.

  2026-07-21 — registration is now mandatory. The old accountless path (type an
  email, audition as a guest) minted orphan `auditions/guest/...` records with no
  password and no single identity — the source of the duplicate-account mess (Wing).
  The email now comes from the VERIFIED session, never client input, and a brand-new
  signup (auth user but no talents row yet — /api/auth/signup only makes the auth
  user) gets a minimal talent profile created here so every auditioner is one
  provable identity. Existing guest tokens already in circulation keep working
  (they hit /casting/<token> directly — grandfathered, per Wing).
*/

// 試音是否已截止 = 案件非 open,或過了 audition_deadline||deadline(當天 23:59)。
function castingClosed(brief: { status?: string | null; audition_deadline?: string | null; deadline?: string | null; created_at?: string | null }): boolean {
  if (brief.status !== 'open') return true;
  return auditionDeadlinePassed(brief);
}

async function loadCasting(briefId: string) {
  const db = getSupabaseServiceClient();
  const { data } = await db
    .from('marketplace_briefs')
    .select('id, title, language, rate_note, kind, status, audition_deadline, audition_deadline_time, timezone, deadline, ai_type, created_at')
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
  let b: { brief_id?: string; name?: string };
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const briefId = String(b.brief_id || '');
  if (!briefId) return NextResponse.json({ error: 'brief_id is required' }, { status: 400 });

  // ── 強制登入:email 一律取自已驗證的 session,不吃前端傳來的 email ──
  const db = getSupabaseServiceClient();
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return NextResponse.json({ error: '請先註冊或登入才能試音', code: 'auth_required' }, { status: 401 });
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user?.email) return NextResponse.json({ error: '登入已過期,請重新登入', code: 'auth_required' }, { status: 401 });
  const email = user.email.trim().toLowerCase();
  const name = String(b.name || '').trim().slice(0, 80);

  const { brief } = await loadCasting(briefId);
  if (!brief) return NextResponse.json({ error: '找不到這個試音案' }, { status: 404 });
  if (castingClosed(brief)) return NextResponse.json({ error: '這個試音案已結束或已截止' }, { status: 400 });

  // ── 找不到 talents 檔就建一個(新註冊者只有 auth 帳號)。以 auth_user_id 為先,
  //    其次 email;都沒有才 insert 最小檔(未上線 is_active=false,之後自助補檔)。──
  let { data: talent } = await db.from('talents').select('id, name').eq('auth_user_id', user.id).maybeSingle();
  if (!talent) {
    const { data: byEmailRows } = await db.from('talents').select('id, name').ilike('email', email).limit(1); // ilike:歷史 email 有大小寫混雜,eq 會 miss → 重複建檔(2026-07-22 審查)
    const byEmail = byEmailRows?.[0] || null;
    if (byEmail) {
      await db.from('talents').update({ auth_user_id: user.id }).eq('id', byEmail.id);
      talent = byEmail;
    }
  }
  if (!talent) {
    const { data: created, error: cErr } = await db.from('talents')
      .insert({ type: 'VO', email, name: name || email.split('@')[0], auth_user_id: user.id, is_active: false })  // type 為 not-null(2026-07-22 IAN 卡註冊實測)
      .select('id, name').maybeSingle();
    if (cErr || !created) return NextResponse.json({ error: '建立配音員檔失敗' }, { status: 500 });
    talent = created;
  }

  // 這個人在這個案子的 invite:有就重用(補上 talent_id),沒有就 mint。
  const { data: existing } = await db.from('casting_invites').select('token, talent_id').eq('brief_id', briefId).eq('email', email).maybeSingle();
  if (existing?.token) {
    if (!existing.talent_id) await db.from('casting_invites').update({ talent_id: talent.id }).eq('brief_id', briefId).eq('email', email);
    return NextResponse.json({ token: existing.token });
  }

  const inviteToken = crypto.randomBytes(24).toString('hex');
  const { error } = await db.from('casting_invites').insert({ brief_id: briefId, email, name: name || talent.name || null, token: inviteToken, talent_id: talent.id });
  if (error) {
    // Possible race (unique brief+email) — re-read and return the winner's token.
    const { data: again } = await db.from('casting_invites').select('token').eq('brief_id', briefId).eq('email', email).maybeSingle();
    if (again?.token) return NextResponse.json({ token: again.token });
    return NextResponse.json({ error: '建立試音連結失敗' }, { status: 500 });
  }
  return NextResponse.json({ token: inviteToken });
}
