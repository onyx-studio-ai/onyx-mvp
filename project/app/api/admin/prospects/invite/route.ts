import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/mail';
import { prospectInviteEmail } from '@/lib/mail-templates';
import { briefMatchesTalentLangs } from '@/lib/languages';

/*
  邀請潛在名單(prospects)——後台案卡「邀請潛在名單」按鈕。
  按案件語言配對 active 配音員 prospect,自動排除:已入駐(status)/黑名單(status)/
  本案冷卻期內已邀(prospect_invites)。send:false 只回人數預覽;send:true 才寄。
  重寄規則=循環:同案冷卻期(預設 7 天)過了、對方沒 joined/suppressed,就能再邀。
*/
const SITE = 'https://www.onyxstudios.ai';
const COOLDOWN_DEFAULT = 7;

export async function POST(request: NextRequest) {
  const unauth = requireAdmin(request);
  if (unauth) return unauth;

  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  const briefId = String(b.brief_id || '');
  const send = b.send === true;
  const cooldownDays = Math.max(0, Number(b.cooldown_days) || COOLDOWN_DEFAULT);
  if (!briefId) return NextResponse.json({ error: 'missing brief_id' }, { status: 400 });

  const db = getSupabaseServiceClient();
  const { data: brief } = await db.from('marketplace_briefs')
    .select('id,title,language,kind,status,audition_deadline,audition_deadline_time,timezone')
    .eq('id', briefId).maybeSingle();
  if (!brief) return NextResponse.json({ error: 'brief not found' }, { status: 404 });
  if (send && brief.status !== 'open') return NextResponse.json({ error: '案件未發佈(open),無法邀請' }, { status: 400 });

  // active 配音員 prospect(不含 joined / suppressed)。
  const { data: pool } = await db.from('prospects')
    .select('id,email,name,languages,unsub_token').eq('kind', 'talent').eq('status', 'active');
  const matched = (pool || []).filter((p) =>
    briefMatchesTalentLangs(String(brief.language || ''), Array.isArray(p.languages) ? p.languages as string[] : []));

  // 冷卻:本案在冷卻窗內已邀過的 prospect → 排除(循環規則核心)。
  const sinceIso = new Date(Date.now() - cooldownDays * 86400_000).toISOString();
  const { data: recent } = await db.from('prospect_invites')
    .select('prospect_id').eq('brief_id', briefId).gte('sent_at', sinceIso);
  const recentSet = new Set((recent || []).map((r) => r.prospect_id));
  const eligible = matched.filter((p) => !recentSet.has(p.id));

  if (!send) {
    return NextResponse.json({
      ok: true, sent: false,
      matched: matched.length,
      cooldown_excluded: matched.length - eligible.length,
      eligible: eligible.length,
      sample: eligible.slice(0, 20).map((p) => ({ name: p.name, email: p.email })),
    });
  }

  const deadline = brief.audition_deadline
    ? `${brief.audition_deadline}${brief.audition_deadline_time ? ' ' + brief.audition_deadline_time : ''}` : '';
  const joinLink = `${SITE}/casting/join/${briefId}`;
  let sent = 0;
  for (const p of eligible) {
    const unsubLink = `${SITE}/api/prospects/unsubscribe?token=${p.unsub_token}`;
    const mail = prospectInviteEmail({
      briefTitle: String(brief.title || ''),
      language: brief.language ? String(brief.language) : undefined,
      joinLink, unsubLink, deadline,
    });
    const r = await sendEmail({ category: 'HELLO', to: p.email, subject: mail.subject, html: mail.html, bcc: 'onyxstudios.ai@gmail.com' })
      .catch(() => ({ success: false } as { success: boolean }));
    if (r.success) {
      await db.from('prospect_invites').insert({ prospect_id: p.id, brief_id: briefId, brief_title: brief.title, channel: 'resend' });
      await db.from('prospects').update({ last_invited_at: new Date().toISOString() }).eq('id', p.id);
      sent++;
    }
  }
  return NextResponse.json({ ok: true, sent: true, count: sent });
}
