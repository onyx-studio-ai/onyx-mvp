import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { requireAdmin, requireAdminOnly } from '@/app/api/admin/_utils/requireAdmin';
import { sendEmail } from '@/lib/mail';
import { castingAwardedTalentEmail, castingAwardedClientEmail, plainNoticeEmail } from '@/lib/mail-templates';
import { notifyTalentTelegram } from '@/lib/telegram';
import { notifyTalentLine } from '@/lib/line';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.onyxstudios.ai';

/*
  Admin marketplace view — Onyx mediates briefs + quotes (managed model).
  GET: all briefs + all quotes (with talent name/email) so Onyx can coordinate.
  PATCH: move a brief or quote through its states; accepting a quote awards the
  brief and auto-rejects the other live quotes.

  Degrades gracefully (empty + unavailable) if the marketplace tables aren't
  migrated yet.
*/

const BRIEF_STATUSES = ['open', 'reviewing', 'awarded', 'closed', 'cancelled'];
const QUOTE_STATUSES = ['submitted', 'shortlisted', 'accepted', 'rejected', 'withdrawn'];

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const db = getSupabaseServiceClient();
    const { data: briefs, error } = await db
      .from('marketplace_briefs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    const { data: quotes } = await db
      .from('marketplace_quotes')
      .select('*, talents(name, email)')
      .order('created_at', { ascending: false });
    return NextResponse.json({ briefs: briefs || [], quotes: quotes || [] });
  } catch {
    return NextResponse.json({ briefs: [], quotes: [], unavailable: true });
  }
}

export async function PATCH(request: NextRequest) {
  // Awarding a brief decides who gets paid — restrict to the admin role.
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;
  try {
    const db = getSupabaseServiceClient();
    const body = await request.json();
    const { kind, id, status } = body;
    const now = new Date().toISOString();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    if (kind === 'brief') {
      // Field edit (e.g. 報酬 rate_note) — no status transition involved.
      if (status === undefined && body.rate_note !== undefined) {
        const { error } = await db.from('marketplace_briefs').update({ rate_note: String(body.rate_note).slice(0, 200) || null, updated_at: now }).eq('id', id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
      }
      if (!status || !BRIEF_STATUSES.includes(status)) return NextResponse.json({ error: 'Invalid brief status' }, { status: 400 });
      // Reopening/cancelling clears the stale award pointer so it can't linger.
      const patch: Record<string, unknown> = { status, updated_at: now };
      if (['open', 'reviewing', 'cancelled'].includes(status)) patch.awarded_quote_id = null;
      // 結案理由(Wing 2026-07-18:投過的人要有交代)。有值才帶欄位,migration 前不擋。
      const closeReason = ['not_awarded', 'client_cancelled', 'other'].includes(String(body.close_reason)) ? String(body.close_reason) : null;
      if (['closed', 'cancelled'].includes(status) && closeReason) patch.close_reason = closeReason;
      const { error } = await db.from('marketplace_briefs').update(patch).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // 結案自動通知投遞者(預設開;石沉大海感的解藥)—— 站內+品牌信+LINE/TG,體面話術。
      if (['closed', 'cancelled'].includes(status) && body.notify_talents !== false) {
        try {
          const [{ data: bf }, { data: qs }] = await Promise.all([
            db.from('marketplace_briefs').select('title, content_type').eq('id', id).maybeSingle(),
            db.from('marketplace_quotes').select('talent_id').eq('brief_id', id).in('status', ['submitted', 'shortlisted']),
          ]);
          const title = (bf?.title as string) || (bf?.content_type as string) || '配音案件';
          const reasonText = closeReason === 'client_cancelled' || status === 'cancelled'
            ? '因客戶端計畫變更,本案已結束。'
            : '本案最終未進入製作。';
          const bodyText = `【${title}】結案通知:您好,感謝您為本案提交試音。${reasonText}您的表現我們都有紀錄,之後有合適的案件會優先考慮您。期待下次合作!— Onyx Studios 製作部`;
          const tids = [...new Set((qs || []).map((q) => q.talent_id as string).filter(Boolean))];
          if (tids.length) {
            const { data: ts } = await db.from('talents').select('id, name, email').in('id', tids);
            for (const t of ts || []) {
              await db.from('marketplace_messages').insert({ brief_id: id, talent_id: t.id, sender_type: 'admin', sender_name: 'Onyx', body: bodyText }).then(() => {}, () => {});
              const email = String(t.email || '');
              if (email && !email.endsWith('@invite.onyxstudios.ai')) {
                const note = plainNoticeEmail({
                  subject: `結案通知 — ${title}`, headline: '結案通知', sub: title, cardTitle: '感謝您的試音',
                  paragraphs: [`${t.name ? t.name + ' ' : ''}您好,`, `感謝您為「${title}」提交試音。${reasonText}`],
                  footnote: '您的表現我們都有紀錄,之後有合適的案件會優先考慮您。期待下次合作!— Onyx Studios 製作部',
                });
                sendEmail({ category: 'PRODUCTION', to: email, subject: note.subject, html: note.html }).catch(() => {});
              }
              notifyTalentTelegram(db, t.id as string, `【${title}】結案通知:${reasonText}感謝您的試音,之後有合適案件會優先考慮您。`);
              notifyTalentLine(db, t.id as string, `【${title}】結案通知:${reasonText}感謝您的試音,之後有合適案件會優先考慮您。`);
            }
          }
        } catch { /* 通知 best-effort,不擋結案 */ }
      }
      return NextResponse.json({ ok: true });
    }

    if (kind === 'quote') {
      if (!QUOTE_STATUSES.includes(status)) return NextResponse.json({ error: 'Invalid quote status' }, { status: 400 });

      if (status === 'accepted') {
        // Accept only a quote that is still live (can't resurrect a withdrawn/rejected one).
        const { data: q } = await db
          .from('marketplace_quotes')
          .update({ status: 'accepted', updated_at: now })
          .eq('id', id)
          .in('status', ['submitted', 'shortlisted'])
          .select('brief_id, talent_id, role_name')
          .maybeSingle();
        if (!q) return NextResponse.json({ error: 'Quote is no longer available to accept' }, { status: 409 });

        // Load the brief once — decides single-voice vs multi-role AND feeds the notify.
        const { data: brief } = await db.from('marketplace_briefs')
          .select('roles, title, content_type, client_email, locale, awarded_quote_id, status')
          .eq('id', q.brief_id).maybeSingle();
        const briefRoles = (Array.isArray((brief as { roles?: { name?: string }[] } | null)?.roles) ? (brief as { roles?: { name?: string }[] }).roles! : [])
          .map((ro) => ro?.name).filter((n): n is string => !!n);
        const isMultiRole = !!q.role_name && briefRoles.length > 0;

        if (isMultiRole) {
          // Multi-role: accept THIS role's winner without touching the other roles.
          // Reject only the other live quotes FOR THE SAME ROLE; leave other roles open
          // to keep picking. Brief goes 'awarded' (enables 建立製作單) but keeps NO single
          // awarded_quote_id and can still accept more roles — to-order builds from every
          // accepted quote.
          await db.from('marketplace_quotes').update({ status: 'rejected', updated_at: now })
            .eq('brief_id', q.brief_id).eq('role_name', q.role_name).neq('id', id).in('status', ['submitted', 'shortlisted']);
          if (brief?.status !== 'awarded') {
            await db.from('marketplace_briefs').update({ status: 'awarded', updated_at: now }).eq('id', q.brief_id);
          }
        } else {
          // Single-voice: award the brief once (prevents double-award), reject everyone else.
          const { data: awarded } = await db.from('marketplace_briefs')
            .update({ awarded_quote_id: id, status: 'awarded', updated_at: now })
            .eq('id', q.brief_id).is('awarded_quote_id', null).select('id').maybeSingle();
          if (!awarded) {
            await db.from('marketplace_quotes').update({ status: 'submitted', updated_at: now }).eq('id', id);
            return NextResponse.json({ error: 'This brief is already awarded' }, { status: 409 });
          }
          await db.from('marketplace_quotes').update({ status: 'rejected', updated_at: now })
            .eq('brief_id', q.brief_id).neq('id', id).in('status', ['submitted', 'shortlisted']);
        }

        // Notify the winning talent + the client that a selection was made (best-effort).
        try {
          const { data: talent } = await db.from('talents').select('name, email').eq('id', q.talent_id).maybeSingle();
          const title = String(brief?.title || brief?.content_type || '配音案');
          if (talent?.email) {
            const m = castingAwardedTalentEmail({ talentName: talent.name as string, title, url: `${SITE}/talent`, locale: brief?.locale as string });
            sendEmail({ category: 'HELLO', to: talent.email as string, subject: m.subject, html: m.html }).catch(() => {});
          }
          if (brief?.client_email && brief.client_email !== 'casting@onyxstudios.ai') {
            const m = castingAwardedClientEmail({ title, url: `${SITE}/dashboard/requests`, locale: brief?.locale as string });
            sendEmail({ category: 'HELLO', to: brief.client_email as string, subject: m.subject, html: m.html }).catch(() => {});
          }
        } catch { /* award notify is best-effort */ }
        return NextResponse.json({ ok: true });
      }

      // Non-accept transitions (shortlist / reject / withdraw).
      const { error } = await db.from('marketplace_quotes').update({ status, updated_at: now }).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown kind' }, { status: 400 });
  } catch (err) {
    console.error('[admin/marketplace] PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
