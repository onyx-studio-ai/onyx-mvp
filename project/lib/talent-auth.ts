import { NextRequest } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import type { SupabaseClient } from '@supabase/supabase-js';

/*
  Resolve the talent that owns the request's Supabase session (Bearer access
  token from the browser client), scoped strictly to their own talents row via
  auth_user_id. Shared by the talent self-service APIs so the auth check lives
  in one place. Returns either { db, talent } or { error, status }.
*/
export async function resolveTalentFromRequest(
  request: NextRequest,
  columns = 'id'
): Promise<{ db: SupabaseClient; talent: Record<string, unknown> } | { error: string; status: 401 | 404 }> {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { error: 'Not authenticated', status: 401 };

  const db = getSupabaseServiceClient();
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) return { error: 'Invalid or expired session', status: 401 };

  // Resolve the talent that owns this session — NOT gated on is_active. Auditioners
  // and invited talents are is_active=false by default (they audition via the casting
  // magic-link before being published), yet still need the portal to manage their own
  // auditions: upload extra demos when asked, deliver directly-assigned roles, edit
  // their profile. Every endpoint here is own-data-scoped, so an unpublished talent
  // only ever sees their own rows. (A real ban would need a distinct suspended flag,
  // not this default-false column.) Mirrors the /api/talent/me resolver.
  const sel = columns.includes('id') ? columns : `id, ${columns}`;
  let { data: talent } = await db
    .from('talents')
    .select(sel)
    .eq('auth_user_id', user.id)
    .maybeSingle();
  // Fall back to the user's verified email + lazy-link auth_user_id.
  if (!talent && user.email) {
    const { data: byEmail } = await db
      .from('talents')
      .select(sel)
      .eq('email', user.email)
      .maybeSingle();
    if (byEmail) {
      await db.from('talents').update({ auth_user_id: user.id }).eq('id', (byEmail as unknown as { id: string }).id);
      talent = byEmail;
    }
  }
  if (!talent) return { error: 'No talent profile is linked to this account', status: 404 };

  return { db, talent: talent as unknown as Record<string, unknown> };
}
