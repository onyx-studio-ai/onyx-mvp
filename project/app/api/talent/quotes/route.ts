import { NextRequest, NextResponse } from 'next/server';
import { resolveTalentFromRequest } from '@/lib/talent-auth';
import { sendEmail } from '@/lib/mail';
import { quoteReceivedEmail, deliveryUploadedEmail } from '@/lib/mail-templates';

/*
  POST /api/talent/quotes — a talent submits a quote on an open brief.

  Money model: the talent enters the GROSS amount the client would pay; the DB
  derives their NET take-home (gross × (1 − commission_rate)). commission_rate
  defaults to 0.20 (the onboarding-agreed rate). The talent always sees NET.

  Onyx is notified (system email) so it can mediate the award (managed model).
  DELETE — withdraw an active quote.
*/

const CURRENCIES = ['USD', 'TWD'];

export async function POST(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id, name');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const talent = r.talent as { id: string; name: string };

  try {
    const body = await request.json();
    const briefId = String(body.brief_id || '');
    const gross = Number(body.gross_amount);
    const currency = CURRENCIES.includes(body.currency) ? body.currency : 'USD';
    const message = String(body.message || '').slice(0, 2000);
    // Casting-call audition fields (optional — present when responding to a casting call):
    // the uploaded audition audio, the talent's self-intro, and their own revision policy.
    const sampleUrl = String(body.sample_url || '').slice(0, 1000) || null;
    const intro = String(body.intro || '').slice(0, 3000) || null;
    const inclRev = Number.isFinite(Number(body.included_revisions)) ? Math.max(0, Math.trunc(Number(body.included_revisions))) : null;
    const extraRevPrice = String(body.extra_revision_price || '').slice(0, 200) || null;
    const roleName = String(body.role_name || '').slice(0, 80) || null;  // which role this audition is for (casting)

    if (!briefId) return NextResponse.json({ error: 'brief_id is required' }, { status: 400 });
    if (!isFinite(gross) || gross <= 0) return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });

    // Brief must exist and be open.
    const { data: brief } = await r.db
      .from('marketplace_briefs')
      .select('id, brief_number, status, kind, client_email')
      .eq('id', briefId)
      .maybeSingle();
    if (!brief) return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
    if (brief.status !== 'open') return NextResponse.json({ error: 'This brief is no longer open' }, { status: 400 });
    // Note: audition_cap is a SOFT "popular" threshold (a UI nudge to try other
    // roles), NOT a hard cap — a busy role can still receive more auditions.

    // Commission keys off the SOURCE, not kind (every case is kind='casting' now):
    // Onyx PLATFORM-posted cases take NO cut (the price IS the talent's take-home;
    // Onyx's margin lives in the Onyx↔client deal). CLIENT-posted cases carry 20%.
    const isPlatform = brief.client_email === 'casting@onyxstudios.ai';

    const { data, error } = await r.db
      .from('marketplace_quotes')
      .insert({
        brief_id: briefId, talent_id: talent.id, gross_amount: gross, currency, message,
        sample_url: sampleUrl, intro, included_revisions: inclRev, extra_revision_price: extraRevPrice,
        role_name: roleName,
        commission_rate: isPlatform ? 0 : 0.20,
      })
      .select('id, brief_id, role_name, gross_amount, net_amount, commission_rate, currency, status, sample_url')
      .single();
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'You already have an active quote on this brief' }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notify Onyx so it can review + mediate (best-effort, branded).
    const note = quoteReceivedEmail({ talentName: talent.name, briefNumber: brief.brief_number, currency, gross, net: data.net_amount, message });
    sendEmail({ category: 'PRODUCTION', to: 'produce@onyxstudios.ai', subject: note.subject, html: note.html }).catch(() => {});

    return NextResponse.json({ quote: data });
  } catch (err) {
    console.error('[talent/quotes] POST error:', err);
    return NextResponse.json({ error: 'Could not submit quote' }, { status: 500 });
  }
}

/*
  PATCH /api/talent/quotes — the won talent attaches their finished delivery to an
  ACCEPTED quote. Only their own accepted quote can receive a delivery. Onyx is
  notified so production can pick it up.
*/
export async function PATCH(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id, name');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const talent = r.talent as { id: string; name: string };
  try {
    const body = await request.json();
    const id = String(body.id || '');

    // Re-audition: the client asked this talent to re-record. They replace their
    // sample; that clears the request. Only their own quote with a pending request.
    if (body.sample_url && !body.delivery_url) {
      const sampleUrl = String(body.sample_url).slice(0, 1000);
      if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
      if (!/^https?:\/\//i.test(sampleUrl)) return NextResponse.json({ error: 'invalid sample_url' }, { status: 400 });
      const { data, error } = await r.db
        .from('marketplace_quotes')
        .update({ sample_url: sampleUrl, reaudition_note: null, reaudition_requested_at: null, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('talent_id', talent.id)
        .not('reaudition_requested_at', 'is', null)
        .select('id, brief_id, sample_url')
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data) return NextResponse.json({ error: '找不到待重錄的試音' }, { status: 400 });
      return NextResponse.json({ quote: data });
    }

    const deliveryUrl = String(body.delivery_url || '').slice(0, 1000);
    if (!id || !deliveryUrl) return NextResponse.json({ error: 'id and delivery_url are required' }, { status: 400 });
    if (!/^https?:\/\//i.test(deliveryUrl)) return NextResponse.json({ error: 'invalid delivery_url' }, { status: 400 });

    const { data, error } = await r.db
      .from('marketplace_quotes')
      .update({ delivery_url: deliveryUrl, delivery_uploaded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('talent_id', talent.id)
      .eq('status', 'accepted')
      .select('id, brief_id, delivery_url, delivery_uploaded_at')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: '只能為已採用的案件上傳交付' }, { status: 400 });

    // Notify Onyx production that a delivery landed (best-effort, branded).
    const dnote = deliveryUploadedEmail({ talentName: talent.name, quoteId: data.id, url: deliveryUrl });
    sendEmail({ category: 'PRODUCTION', to: 'produce@onyxstudios.ai', subject: dnote.subject, html: dnote.html }).catch(() => {});

    return NextResponse.json({ quote: data });
  } catch {
    return NextResponse.json({ error: 'Could not save delivery' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const talent = r.talent as { id: string };
  try {
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    // Only withdraw your own still-live quote.
    const { error } = await r.db
      .from('marketplace_quotes')
      .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('talent_id', talent.id)
      .in('status', ['submitted', 'shortlisted']);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Could not withdraw quote' }, { status: 500 });
  }
}
