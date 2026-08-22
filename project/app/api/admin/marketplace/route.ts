import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { requireAdmin, requireAdminOnly } from '@/app/api/admin/_utils/requireAdmin';
import { sendEmail } from '@/lib/mail';
import { castingAwardedTalentEmail, castingAwardedClientEmail } from '@/lib/mail-templates';
import { notifyBriefClosed } from '@/lib/brief-close';
import { isPlatformCase, PLATFORM_CASTING_EMAIL } from '@/lib/casting';
import { normCaseLang } from '@/lib/languages';

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
      // reviewing→open 直接上線的口:語言入庫前過 normCaseLang(客戶手打髒語言值不能
      // 原樣 open,否則配音員端語言過濾漏案 —— 2026-07-23 旖樂案同類,寫入端關口治本)。
      if (status === 'open') {
        const { data: cur } = await db.from('marketplace_briefs').select('language').eq('id', id).maybeSingle();
        const rawLang = String(cur?.language || '');
        if (rawLang) {
          const norm = normCaseLang(rawLang);
          if (norm !== rawLang) patch.language = norm;
        }
      }
      // 結案理由(Wing 2026-07-18:投過的人要有交代)。有值才帶欄位,migration 前不擋。
      // no_auditions=零試音的未成案;decided=有試音但未採用(配音員端一律顯示「已定案」)
      const closeReason = ['no_auditions', 'decided', 'other'].includes(String(body.close_reason)) ? String(body.close_reason) : null;
      if (['closed', 'cancelled'].includes(status) && closeReason) patch.close_reason = closeReason;
      const { error } = await db.from('marketplace_briefs').update(patch).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // 結案一鍵通知(共用 lib/brief-close;口徑統一「客戶已定案」,理由只記後台)
      if (['closed', 'cancelled'].includes(status) && body.notify_talents !== false) {
        await notifyBriefClosed(db, id);
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
          // 這兩個 update 靜默失敗 = 落選者仍看到活報價 / 案面狀態不一致(2026-07-23 審查)→ 接 error 回 500。
          const { error: rejErr } = await db.from('marketplace_quotes').update({ status: 'rejected', updated_at: now })
            .eq('brief_id', q.brief_id).eq('role_name', q.role_name).neq('id', id).in('status', ['submitted', 'shortlisted']);
          if (rejErr) return NextResponse.json({ error: rejErr.message }, { status: 500 });
          if (brief?.status !== 'awarded') {
            const { error: awErr } = await db.from('marketplace_briefs').update({ status: 'awarded', updated_at: now }).eq('id', q.brief_id);
            if (awErr) return NextResponse.json({ error: awErr.message }, { status: 500 });
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
          const { error: rejErr } = await db.from('marketplace_quotes').update({ status: 'rejected', updated_at: now })
            .eq('brief_id', q.brief_id).neq('id', id).in('status', ['submitted', 'shortlisted']);
          if (rejErr) return NextResponse.json({ error: rejErr.message }, { status: 500 }); // 同上:落選者不能留活報價
        }

        // 平台量產案的「角色殼單」(先建好掛台詞表/角色卡、還沒有配音員)→ 採用的
        // 當下直接把得標者掛上殼單:talent_id/voice_selection/quote_id 一次補齊,
        // 儀表板不再一片「未指派」、配音員端交付也接得上(quote 交付路徑靠 quote_id
        // 找單);之後「建立製作單」的防重閘(brief+role+talent)會自動跳過已掛人的
        // 角色,不會重複建單(Wing 2026-08-22 拍板)。
        // 安全邊界:只動平台自營殼單(email=casting@ 常數)且 talent_id 為空的,
        // 絕不覆蓋已掛人的單、絕不碰外部客戶單(避免繞過客戶付款關卡)。
        // 失敗不擋採用(殼單可後台手動補),只記 log。
        try {
          const { data: shellsAll } = await db.from('voice_orders').select('id, role_name')
            .eq('brief_id', q.brief_id).eq('email', PLATFORM_CASTING_EMAIL).is('talent_id', null);
          const norm = (s: unknown) => String(s || '').replace(/\s+/g, '');
          const target = norm(q.role_name);
          // 先精確比對;對不到再做「皮膚變體歸主角」:試音的角色名常帶皮膚
          // (武則天_玫瑰夫人、天啟騎士-關羽,前後綴兩種方向都有)→ 找「被包含
          // 在試音角色名裡」的殼單主角名,取最長的,避免短名誤吞。
          let shell = q.role_name
            ? (shellsAll || []).find((s) => norm(s.role_name) === target)
            : (shellsAll || []).find((s) => !s.role_name);
          if (!shell && target) {
            shell = (shellsAll || [])
              .filter((s) => norm(s.role_name).length >= 2 && target.includes(norm(s.role_name)))
              .sort((a, b) => norm(b.role_name).length - norm(a.role_name).length)[0];
          }
          if (shell) {
            const { data: tw } = await db.from('talents').select('name').eq('id', q.talent_id).maybeSingle();
            const { error: fillErr } = await db.from('voice_orders')
              .update({ talent_id: q.talent_id, voice_selection: String(tw?.name || ''), quote_id: id, status: 'in_production', updated_at: now })
              .eq('id', shell.id).is('talent_id', null);
            if (fillErr) console.error('[admin/marketplace] 殼單掛人失敗:', fillErr.message);
          }
        } catch (e) { console.error('[admin/marketplace] 殼單掛人錯誤:', e); }

        // Notify the winning talent + the client that a selection was made (best-effort).
        try {
          const { data: talent } = await db.from('talents').select('name, email').eq('id', q.talent_id).maybeSingle();
          const title = String(brief?.title || brief?.content_type || '配音案');
          if (talent?.email) {
            const m = castingAwardedTalentEmail({ talentName: talent.name as string, title, url: `${SITE}/talent`, locale: brief?.locale as string });
            sendEmail({ category: 'HELLO', to: talent.email as string, subject: m.subject, html: m.html }).catch(() => {});
          }
          if (brief?.client_email && !isPlatformCase(brief.client_email)) {
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
