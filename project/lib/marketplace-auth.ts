import { NextRequest } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import type { SupabaseClient } from '@supabase/supabase-js';

/*
  Resolve the caller of a marketplace messaging request from their Supabase
  session, and authorize them as a party (client or talent) to a (brief,talent)
  thread. A thread exists once the talent has a quote on the brief; Onyx (admin)
  is handled separately via the admin cookie, not here.
*/

export type Caller = { db: SupabaseClient; userId: string; email: string; talentId: string | null };

export async function resolveCaller(request: NextRequest): Promise<Caller | null> {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const db = getSupabaseServiceClient();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return null;
  const user = data.user;
  const { data: t } = await db.from('talents').select('id').eq('auth_user_id', user.id).eq('is_active', true).maybeSingle();
  return { db, userId: user.id, email: (user.email || '').toLowerCase(), talentId: (t as { id: string } | null)?.id || null };
}

/** The caller's role on a (brief, talent) thread, or null if they aren't a party. */
export async function threadRole(c: Caller, briefId: string, talentId: string): Promise<'client' | 'talent' | null> {
  // POST-AWARD ONLY (成單後才能私訊): the thread opens once this talent's quote on
  // the brief is ACCEPTED — i.e. the client picked them. No DMs before that.
  const { data: q } = await c.db
    .from('marketplace_quotes')
    .select('id')
    .eq('brief_id', briefId)
    .eq('talent_id', talentId)
    .eq('status', 'accepted')
    .limit(1)
    .maybeSingle();
  if (!q) return null;

  if (c.talentId && c.talentId === talentId) return 'talent';

  const { data: brief } = await c.db
    .from('marketplace_briefs')
    .select('client_user_id, client_email')
    .eq('id', briefId)
    .maybeSingle();
  if (brief && (brief.client_user_id === c.userId || (brief.client_email || '').toLowerCase() === c.email)) return 'client';

  return null;
}
