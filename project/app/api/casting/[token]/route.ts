import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  Guest casting endpoints (token = the invite link's capability; no login).
    GET  /api/casting/[token] — load the casting call + this guest's auditions.
    POST /api/casting/[token] — submit an audition for a role. On first audition we
      auto-create a lightweight talent (their email) and link it to the invite, so
      returning via the same link shows their work and they can later upgrade to a
      full account (/apply) without losing anything.
  The token is reusable + valid until the call closes (no expiry) so they can read
  now and upload later.
*/
const CURRENCIES = ['USD', 'TWD', 'HKD', 'CNY', 'EUR', 'GBP', 'JPY', 'SGD'];

async function resolveInvite(token: string) {
  const db = getSupabaseServiceClient();
  const { data: invite } = await db.from('casting_invites').select('id, brief_id, email, name, talent_id, status').eq('token', token).maybeSingle();
  if (!invite) return { db, invite: null, brief: null };
  const { data: brief } = await db.from('marketplace_briefs').select('*').eq('id', invite.brief_id).maybeSingle();
  return { db, invite, brief };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { db, invite, brief } = await resolveInvite(token);
  if (!invite || !brief || brief.kind !== 'casting') return NextResponse.json({ error: 'invalid' }, { status: 404 });

  // per-role counts (shown to guest, same as logged-in talents)
  const { data: rq } = await db.from('marketplace_quotes').select('role_name, status').eq('brief_id', brief.id).in('status', ['submitted', 'shortlisted']);
  const roleCounts: Record<string, number> = {};
  for (const q of rq || []) roleCounts[(q.role_name as string) || ''] = (roleCounts[(q.role_name as string) || ''] || 0) + 1;

  // this guest's own auditions (via their linked lightweight talent)
  let myAuditions: unknown[] = [];
  if (invite.talent_id) {
    const { data } = await db.from('marketplace_quotes').select('id, brief_id, role_name, gross_amount, currency, status, sample_url').eq('brief_id', brief.id).eq('talent_id', invite.talent_id);
    myAuditions = data || [];
  }
  return NextResponse.json({ brief, roleCounts, myAuditions, invite: { email: invite.email, name: invite.name }, closed: brief.status !== 'open' });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { db, invite, brief } = await resolveInvite(token);
  if (!invite || !brief || brief.kind !== 'casting') return NextResponse.json({ error: 'invalid' }, { status: 404 });
  if (brief.status !== 'open') return NextResponse.json({ error: '這個試音案已結束' }, { status: 400 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const roleName = String(body.role_name || '').slice(0, 80) || null;
  const sampleUrl = String(body.sample_url || '').slice(0, 1000);
  const intro = String(body.intro || '').slice(0, 3000) || null;
  const gross = Number(body.gross_amount);
  const currency = CURRENCIES.includes(String(body.currency)) ? String(body.currency) : 'CNY';
  if (!sampleUrl) return NextResponse.json({ error: '請先上傳試音音檔' }, { status: 400 });
  if (!isFinite(gross) || gross <= 0) return NextResponse.json({ error: '請填報價' }, { status: 400 });

  // ensure a lightweight talent for this guest (their upgrade path)
  let talentId = invite.talent_id as string | null;
  if (!talentId) {
    const { data: t, error: tErr } = await db.from('talents')
      .insert({ type: 'voice_actor', name: invite.name || invite.email, email: invite.email, is_active: false })
      .select('id').single();
    if (tErr || !t) return NextResponse.json({ error: '建立試音身分失敗' }, { status: 500 });
    talentId = t.id;
    await db.from('casting_invites').update({ talent_id: talentId }).eq('id', invite.id);
  }

  const { data, error } = await db.from('marketplace_quotes')
    .insert({ brief_id: brief.id, talent_id: talentId, role_name: roleName, sample_url: sampleUrl, intro, message: intro, gross_amount: gross, currency, invite_id: invite.id })
    .select('id, brief_id, role_name, gross_amount, currency, status, sample_url').single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: '你已經試過這個角色了' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await db.from('casting_invites').update({ status: 'responded', responded_at: new Date().toISOString() }).eq('id', invite.id);
  return NextResponse.json({ audition: data });
}
