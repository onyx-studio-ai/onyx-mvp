import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient, supabaseErrorResponse } from '@/lib/supabase-server';

/*
  Talent self-service profile API. Authenticated by the talent's OWN Supabase
  session (Bearer access token from the browser client). Every operation is
  scoped to their own talents row via auth_user_id — a talent can only ever
  read or write their own profile, never anyone else's.
*/

// Fields a talent may edit themselves. Service classification (tags), internal
// cost, demos, is_active and identity are intentionally excluded.
const EDITABLE = ['name', 'bio', 'languages', 'accent', 'gender'] as const;

async function resolveTalent(request: NextRequest) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { error: 'Not authenticated', status: 401 as const };

  const db = getSupabaseServiceClient();
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) return { error: 'Invalid or expired session', status: 401 as const };

  const { data: talent } = await db
    .from('talents')
    .select('id, name, bio, languages, accent, gender, tags, demo_urls, type, email, is_active')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (!talent) return { error: 'No talent profile is linked to this account', status: 404 as const };

  return { db, talent };
}

export async function GET(request: NextRequest) {
  try {
    const r = await resolveTalent(request);
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ talent: r.talent });
  } catch (err) {
    return supabaseErrorResponse(err, 'api/talent/me:GET');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const r = await resolveTalent(request);
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    for (const k of EDITABLE) if (k in body) updates[k] = body[k];

    if ('name' in updates && (typeof updates.name !== 'string' || !updates.name.trim())) {
      return NextResponse.json({ error: 'Display name cannot be empty' }, { status: 400 });
    }
    if ('languages' in updates && !Array.isArray(updates.languages)) {
      return NextResponse.json({ error: 'languages must be an array' }, { status: 400 });
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { data, error } = await r.db
      .from('talents')
      .update(updates)
      .eq('id', r.talent.id)
      .select('id, name, bio, languages, accent, gender')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ talent: data });
  } catch (err) {
    return supabaseErrorResponse(err, 'api/talent/me:PATCH');
  }
}
