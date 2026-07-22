import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { auditionDeadlinePassed } from '@/lib/casting';

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
const CURRENCIES = ['USD', 'TWD'];

// 只回試音者該看的欄位(白名單)。marketplace_briefs 的 select('*') 會帶出客戶底牌:
// client_user_id / budget_currency / budget_unit / requested_talent(_id) / has_singing /
// wants_* / gender_needs / local_studio_region / script_file_url…等,一律不外洩。
// budget / budget_type 保留 —— 前台 GuestCasting 會以「客戶預算」顯示,是既有產品行為。
// 客戶身分(client_email/name/company)不在名單內,連同一併排除(source label 另算)。
const GUEST_BRIEF_FIELDS = [
  'id', 'brief_number', 'kind', 'content_type', 'title', 'language', 'rate_note', 'status', 'created_at',
  'budget', 'budget_type',
  'brief', 'audition_script', 'audition_deadline', 'audition_deadline_time', 'deadline', 'deadline_time', 'timezone', 'recording_start', 'recording_methods',
  'reference_files', 'reference_links', 'roles', 'audition_cap', 'base_revisions', 'length', 'license_summary',
  'media_scope', 'territory', 'license_term', 'accent', 'voice_style', 'voice_age',
] as const;

function pickGuestBrief(brief: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of GUEST_BRIEF_FIELDS) if (k in brief) out[k] = brief[k];
  // platform 案不收平台費、client 案收 20% —— 前台靠這個 label 判斷,不外洩客戶 email 本身。
  out.source = brief.client_email === 'casting@onyxstudios.ai' ? 'platform' : 'client';
  return out;
}

// 試音是否已截止 = 案件非 open,或過了 audition_deadline||deadline(用共用
// auditionDeadlinePassed,吃 ISO 也吃舊「6/30」短字串)。沒設截止 = 不算截止。
function castingClosed(brief: { status?: string | null; audition_deadline?: string | null; deadline?: string | null; created_at?: string | null }): boolean {
  if (brief.status !== 'open') return true;
  return auditionDeadlinePassed(brief);
}

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
  // 白名單挑欄位 → 只回試音者該看的,客戶身分/預算幣別/指名配音員等底牌一律不外洩。
  const safeBrief = pickGuestBrief(brief as Record<string, unknown>);
  // 已徵得的角色(只給角色名,不露指派給誰)—— 前台標「已徵得」。
  const { data: aos } = await db.from('voice_orders').select('role_name').eq('brief_id', invite.brief_id).not('role_name', 'is', null);
  const assignedRoles = [...new Set((aos || []).map((o) => String(o.role_name)))];
  return NextResponse.json({ brief: safeBrief, roleCounts, myAuditions, assignedRoles, invite: { email: invite.email, name: invite.name }, closed: castingClosed(brief) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { db, invite, brief } = await resolveInvite(token);
  if (!invite || !brief || brief.kind !== 'casting') return NextResponse.json({ error: 'invalid' }, { status: 404 });
  if (castingClosed(brief)) return NextResponse.json({ error: '這個試音案已結束或已截止' }, { status: 400 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const roleName = String(body.role_name || '').slice(0, 80) || null;
  // 授權前置閘(訪客端同樣擋;中選後才反悔授權 = 全部白忙,Wing 2026-07-21)
  if ((brief as { license_summary?: string | null }).license_summary && body.license_agreed !== true) {
    return NextResponse.json({ error: '此案需先同意授權要點才能試音。' }, { status: 400 });
  }
  const sampleUrl = String(body.sample_url || '').slice(0, 1000);
  const intro = String(body.intro || '').slice(0, 3000) || null;
  const gross = Number(body.gross_amount);
  const currency = CURRENCIES.includes(String(body.currency)) ? String(body.currency) : 'TWD';
  if (!sampleUrl) return NextResponse.json({ error: '請先上傳試音音檔' }, { status: 400 });
  if (!isFinite(gross) || gross <= 0) return NextResponse.json({ error: '請填報價' }, { status: 400 });

  // ensure a lightweight talent for this guest (their upgrade path)
  let talentId = invite.talent_id as string | null;
  if (!talentId) {
    // Reuse an existing talent with this email (they may already be a talent, or
    // auditioned via another link) — a plain insert would hit the unique-email
    // constraint and fail with "建立試音身分失敗".
    const email = String(invite.email || '').trim();
    if (email) {
      const { data: existing } = await db.from('talents').select('id').ilike('email', email).limit(1);
      if (existing?.[0]?.id) talentId = existing[0].id as string;
    }
    if (!talentId) {
      const { data: t, error: tErr } = await db.from('talents')
        .insert({ type: 'VO', name: invite.name || email, email, is_active: false })
        .select('id').single();
      if (tErr || !t) {
        console.error('[casting] talent create failed:', tErr?.code, tErr?.message);
        return NextResponse.json({ error: '建立試音身分失敗' }, { status: 500 });
      }
      talentId = t.id;
    }
    await db.from('casting_invites').update({ talent_id: talentId }).eq('id', invite.id);
  }

  // Platform-posted = no cut (take-home); client-posted = 20% commission.
  const commissionRate = brief.client_email === 'casting@onyxstudios.ai' ? 0 : 0.20;
  const { data, error } = await db.from('marketplace_quotes')
    .insert({ brief_id: brief.id, talent_id: talentId, role_name: roleName, sample_url: sampleUrl, intro, message: intro, gross_amount: gross, currency, invite_id: invite.id, commission_rate: commissionRate, license_agreed_at: (brief as { license_summary?: string | null }).license_summary ? new Date().toISOString() : null })
    .select('id, brief_id, role_name, gross_amount, currency, status, sample_url').single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: '你已經試過這個角色了' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await db.from('casting_invites').update({ status: 'responded', responded_at: new Date().toISOString() }).eq('id', invite.id);
  return NextResponse.json({ audition: data });
}
