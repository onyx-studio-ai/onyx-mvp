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

  // Only ACTIVE talents may use the marketplace APIs. A deactivated talent
  // keeps a valid session + row, so without this gate they could keep quoting.
  const sel = columns.includes('id') ? columns : `id, ${columns}`;
  let { data: talent } = await db
    .from('talents')
    .select(sel)
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();
  // Fall back to the user's verified email + lazy-link auth_user_id (active only).
  if (!talent && user.email) {
    const { data: byEmail } = await db
      .from('talents')
      .select(sel)
      .eq('email', user.email)
      .eq('is_active', true)
      .maybeSingle();
    if (byEmail) {
      await db.from('talents').update({ auth_user_id: user.id }).eq('id', (byEmail as { id: string }).id);
      talent = byEmail;
    }
  }
  if (!talent) return { error: 'No active talent profile is linked to this account', status: 404 };

  return { db, talent: talent as unknown as Record<string, unknown> };
}
