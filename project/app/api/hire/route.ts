import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mail';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { briefReceivedEmail } from '@/lib/mail-templates';

/*
  Client brief intake. Persists the brief to marketplace_briefs (Phase 3c) so
  active talents can quote on it, AND emails Onyx + a localized confirmation to
  the client. The DB write is best-effort: if the table isn't migrated yet, the
  Phase 2 email-only behaviour still works.
*/

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const esc = (s: unknown) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));

export async function POST(request: NextRequest) {
  try {
    const b = await request.json();
    const email = String(b.email || '').trim();
    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    if (!String(b.brief || '').trim()) return NextResponse.json({ error: 'Brief is required' }, { status: 400 });

    const typeLabel = b.content_type || (Array.isArray(b.categories) ? b.categories.join(', ') : '');

    // Persist to the talent marketplace (best-effort; non-fatal pre-migration).
    let briefNumber = '';
    try {
      const db = getSupabaseServiceClient();
      const { data: inserted, error: insErr } = await db
        .from('marketplace_briefs')
        .insert({
          // A client request feeds the SAME casting system, but lands as a review
          // draft (not live, no auto-notify) — Onyx confirms the roles + the
          // talent take-home rate, then publishes it from the admin.
          kind: 'casting',
          status: 'reviewing',
          title: b.title || null,
          client_email: email.toLowerCase(), // normalized for exact-match thread lookup
          client_name: b.name || null,
          company: b.company || null,
          categories: Array.isArray(b.categories) ? b.categories : [],
          content_type: b.content_type || null,
          media_scope: b.media_scope || null,
          territory: b.territory || null,
          license_term: b.license_term || null,
          ref_audio_url: b.ref_audio_url || null,
          has_singing: !!b.has_singing,
          audition_deadline: b.audition_deadline || null,
          wants_director: !!b.wants_director,
          wants_live_session: !!b.wants_live_session,
          live_session_tool: b.live_session_tool || null,
          budget_type: b.budget_type || null,
          language: b.language || null,
          accent: (typeof b.accent === 'string' && b.accent.trim()) ? b.accent.trim().slice(0, 120) : null,
          voice_style: (typeof b.voice_style === 'string' && b.voice_style.trim()) ? b.voice_style.trim().slice(0, 120) : null,
          voice_age: (typeof b.voice_age === 'string' && b.voice_age.trim()) ? b.voice_age.trim().slice(0, 120) : null,
          length: b.length || null,
          voices_needed: Number.isFinite(parseInt(String(b.voices_needed), 10)) ? parseInt(String(b.voices_needed), 10) : null,
          gender_needs: (typeof b.gender_needs === 'string' && b.gender_needs.trim()) ? b.gender_needs.trim().slice(0, 120) : null,
          script_text: (typeof b.script_text === 'string' && b.script_text.trim()) ? b.script_text.trim().slice(0, 20000) : null,
          script_file_url: (typeof b.script_file_url === 'string' && /^https?:\/\//i.test(b.script_file_url)) ? b.script_file_url.slice(0, 1000) : null,
          script_type: (b.script_type === 'audition' || b.script_type === 'final') ? b.script_type : null,
          roles_file_url: (typeof b.roles_file_url === 'string' && /^https?:\/\//i.test(b.roles_file_url)) ? b.roles_file_url.slice(0, 1000) : null,
          local_studio_region: (typeof b.local_studio_region === 'string' && b.local_studio_region.trim()) ? b.local_studio_region.trim().slice(0, 120) : null,
          budget: b.budget || null,
          deadline: b.deadline || null,
          brief: String(b.brief),
          requested_talent: (typeof b.requested_talent === 'string' && b.requested_talent.trim()) ? b.requested_talent.trim().slice(0, 200) : null,
          locale: b.locale || '',
        })
        .select('brief_number')
        .single();
      if (insErr) console.error('[hire] brief persist failed (non-fatal):', insErr.message);
      else briefNumber = inserted?.brief_number || '';
    } catch (e) {
      console.error('[hire] brief persist threw (non-fatal):', e);
    }

    const row = (label: string, val: unknown) =>
      val ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;white-space:nowrap;vertical-align:top;">${label}</td><td style="padding:4px 0;color:#111;">${esc(val)}</td></tr>` : '';

    // 1) Notify Onyx team
    const teamHtml = `<div style="font-family:system-ui,sans-serif;max-width:560px;">
      <h2 style="margin:0 0 12px;">新配音需求 / New voiceover brief</h2>
      <table style="font-size:14px;border-collapse:collapse;">
        ${row('Email', email)}
        ${row('稱呼 Name', b.name)}
        ${row('公司 Company', b.company)}
        ${row('類型 Type', typeLabel)}
        ${row('含唱歌 Singing', b.has_singing ? 'Yes' : '')}
        ${row('媒體 Media', b.media_scope)}
        ${row('地區 Territory', b.territory)}
        ${row('授權 License', b.license_term)}
        ${row('語言 Language', b.language)}
        ${row('長度 Length', b.length)}
        ${row('預算 Budget', b.budget ? `${b.budget_type || ''} ${b.budget}`.trim() : '')}
        ${row('試音截止 Audition', b.audition_deadline)}
        ${row('交付截止 Delivery', b.deadline)}
        ${row('聲音導演 Director', b.wants_director ? 'Yes' : '')}
        ${row('線上同步錄音 Live', b.wants_live_session ? (b.live_session_tool ? `Yes (${b.live_session_tool})` : 'Yes') : '')}
        ${row('稿件 Script', b.script_status)}
        ${row('參考聲音 Ref', b.ref_audio_url)}
        ${row('語系 Locale', b.locale)}
      </table>
      <p style="margin:14px 0 4px;color:#6b7280;font-size:13px;">需求說明 / Brief:</p>
      <p style="white-space:pre-wrap;background:#f4f4f5;border-radius:8px;padding:12px;font-size:14px;color:#111;">${esc(b.brief)}</p>
    </div>`;
    await sendEmail({ category: 'HELLO', to: 'hello@onyxstudios.ai', subject: `新配音需求 — ${b.name || email}${typeLabel ? ` (${typeLabel})` : ''}`, html: teamHtml, replyTo: email });

    // 2) Provision a client account (so they can log in to /dashboard and track this
    //    request) + a set-password link. Best-effort; reuses an existing user if the
    //    email is already registered.
    let setupUrl: string | undefined;
    try {
      const adb = getSupabaseServiceClient();
      const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.onyxstudios.ai';
      const lc = String(b.locale || '');
      const lp = lc && lc !== 'en' ? `/${lc}` : '';
      await adb.auth.admin.createUser({ email: email.toLowerCase(), email_confirm: true }).catch(() => ({}));
      const { data: link } = await adb.auth.admin.generateLink({
        type: 'recovery', email: email.toLowerCase(),
        options: { redirectTo: `${SITE}${lp}/auth/reset-password` },
      });
      setupUrl = link?.properties?.action_link || undefined;
    } catch (e) { console.error('[hire] client account provisioning failed (non-fatal):', e); }

    // 3) Confirm to the client (branded + localized) with the set-password / track CTA
    const confirm = briefReceivedEmail({ clientName: b.name, briefNumber, locale: b.locale, setupUrl });
    await sendEmail({ category: 'HELLO', to: email, subject: confirm.subject, html: confirm.html });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[hire] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
