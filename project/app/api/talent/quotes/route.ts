import { NextRequest, NextResponse } from 'next/server';
import { resolveTalentFromRequest } from '@/lib/talent-auth';
import { sendEmail } from '@/lib/mail';
import { quoteReceivedEmail, deliveryUploadedEmail, castingDeliveryClientEmail } from '@/lib/mail-templates';
import { sanitizeMessage } from '@/lib/message-filter';

const SITE = 'https://www.onyxstudios.ai';

/*
  POST /api/talent/quotes — a talent submits a quote on an open brief.

  Money model: the talent enters the GROSS amount the client would pay; the DB
  derives their NET take-home (gross × (1 − commission_rate)). commission_rate
  defaults to 0.20 (the onboarding-agreed rate). The talent always sees NET.

  Onyx is notified (system email) so it can mediate the award (managed model).
  DELETE — withdraw an active quote.
*/

// Accept the deal currencies the brief can be posted in (the talent quotes in the
// brief's fixed currency — see dealCurrency on the opportunities page). Kept broad
// so a non-USD/TWD deal currency isn't silently downgraded to USD.
const CURRENCIES = ['USD', 'TWD'];   // 全站只收台幣 / 美金,其他幣別不支援

export async function POST(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id, name');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const talent = r.talent as { id: string; name: string };

  try {
    const body = await request.json();
    const briefId = String(body.brief_id || '');
    const gross = Number(body.gross_amount);
    const currency = CURRENCIES.includes(body.currency) ? body.currency : 'USD';
    // intro/message are shown to the client on the audition list PRE-award — strip
    // contact info (email/phone/IM/links) so a talent can't route around Onyx.
    const message = sanitizeMessage(String(body.message || '').slice(0, 2000)).clean;
    // Casting-call audition fields (optional — present when responding to a casting call):
    // the uploaded audition audio, the talent's self-intro, and their own revision policy.
    const sampleUrl = String(body.sample_url || '').slice(0, 1000) || null;
    const intro = sanitizeMessage(String(body.intro || '').slice(0, 3000)).clean || null;
    const inclRev = Number.isFinite(Number(body.included_revisions)) ? Math.max(0, Math.trunc(Number(body.included_revisions))) : null;
    const extraRevPrice = String(body.extra_revision_price || '').slice(0, 200) || null;
    const roleName = String(body.role_name || '').slice(0, 80) || null;  // which role this audition is for (casting)

    if (!briefId) return NextResponse.json({ error: 'brief_id is required' }, { status: 400 });
    if (!isFinite(gross) || gross <= 0) return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });

    // Brief must exist and be open.
    const { data: brief } = await r.db
      .from('marketplace_briefs')
      .select('id, brief_number, status, kind, client_email, audition_deadline, deadline')
      .eq('id', briefId)
      .maybeSingle();
    if (!brief) return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
    if (brief.status !== 'open') return NextResponse.json({ error: 'This brief is no longer open' }, { status: 400 });
    // 試音截止:過了截止日(當天 23:59)就不再收試音;沒設試音截止就用交付截止當界線。parse 失敗不擋。
    const closeBy = brief.audition_deadline || brief.deadline;
    if (closeBy) {
      const dl = new Date(`${String(closeBy).slice(0, 10)}T23:59:59`).getTime();
      if (Number.isFinite(dl) && Date.now() > dl) return NextResponse.json({ error: '這個案子的試音已截止。' }, { status: 400 });
    }
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

    // Accept the job agreement (授權書) — required before the talent can start /
    // upload a delivery. Only their own accepted (won) quote.
    if (body.accept_agreement) {
      if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
      const { data, error } = await r.db
        .from('marketplace_quotes')
        .update({ agreement_accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('talent_id', talent.id)
        .eq('status', 'accepted')
        .select('id, agreement_accepted_at')
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data) return NextResponse.json({ error: '找不到可接單的案件' }, { status: 400 });
      return NextResponse.json({ quote: data });
    }

    // Add an EXTRA demo (other tones / characters) the client/Onyx asked for.
    // APPENDS to extra_samples (does NOT replace the audition) + clears the request
    // flag. Only their own quote.
    if (body.add_extra_sample) {
      if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
      const url = String(body.add_extra_sample).slice(0, 1000);
      if (!/^https?:\/\//i.test(url)) return NextResponse.json({ error: 'invalid url' }, { status: 400 });
      const label = String(body.label || '').slice(0, 80).trim();
      const { data: cur } = await r.db.from('marketplace_quotes').select('extra_samples').eq('id', id).eq('talent_id', talent.id).maybeSingle();
      if (!cur) return NextResponse.json({ error: '找不到這個試音' }, { status: 400 });
      const arr = Array.isArray((cur as { extra_samples?: unknown[] }).extra_samples) ? (cur as { extra_samples: unknown[] }).extra_samples : [];
      arr.push({ url, label: label || null, created_at: new Date().toISOString() });
      const { data, error } = await r.db
        .from('marketplace_quotes')
        .update({ extra_samples: arr.slice(0, 12), more_demos_requested_at: null, updated_at: new Date().toISOString() })
        .eq('id', id).eq('talent_id', talent.id)
        .select('id, extra_samples')
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ quote: data });
    }

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

    // Remove one of the talent's own delivered files (only while not completed).
    if (body.delete_version_id) {
      const vid = String(body.delete_version_id);
      const { data: q } = await r.db.from('marketplace_quotes').select('id, talent_id').eq('id', id).eq('talent_id', talent.id).maybeSingle();
      if (!q) return NextResponse.json({ error: 'not your job' }, { status: 403 });
      const { data: ord } = await r.db.from('voice_orders').select('id, status').eq('quote_id', id).maybeSingle();
      if (!ord || ord.status === 'completed') return NextResponse.json({ error: '已完成的交付無法刪除' }, { status: 400 });
      await r.db.from('voice_order_versions').delete().eq('id', vid).eq('voice_order_id', ord.id);
      return NextResponse.json({ ok: true });
    }

    const deliveryUrl = String(body.delivery_url || '').slice(0, 1000);
    const deliveryName = String(body.file_name || '').slice(0, 200) || (deliveryUrl.split('/').pop()?.split('?')[0] || 'delivery');
    if (!id || !deliveryUrl) return NextResponse.json({ error: 'id and delivery_url are required' }, { status: 400 });
    if (!/^https?:\/\//i.test(deliveryUrl)) return NextResponse.json({ error: 'invalid delivery_url' }, { status: 400 });

    // Real-person casting orders only execute AFTER payment — block delivery on an
    // unpaid order (Wing: 真人案都要付款才會執行).
    const { data: payChk } = await r.db.from('voice_orders').select('payment_status').eq('quote_id', id).maybeSingle();
    if (payChk && !['paid', 'completed'].includes(String(payChk.payment_status))) {
      return NextResponse.json({ error: '客戶尚未付款,付款後才能開始製作 / 上傳交付。' }, { status: 400 });
    }

    const { data, error } = await r.db
      .from('marketplace_quotes')
      .update({ delivery_url: deliveryUrl, delivery_uploaded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('talent_id', talent.id)
      .eq('status', 'accepted')
      .not('agreement_accepted_at', 'is', null) // must have accepted the job agreement first
      .select('id, brief_id, delivery_url, delivery_uploaded_at')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: '請先「同意並接單」才能上傳交付。' }, { status: 400 });

    // Self-serve: the delivery becomes a client-reviewable version (reuses the
    // existing 核准 / 要求修改 flow). Each upload adds another file (multi-file +
    // future revisions); the order moves to "delivered" for the client to review.
    const { data: order } = await r.db.from('voice_orders').select('id, email, order_number, status').eq('quote_id', id).maybeSingle();
    let firstDelivery = true;
    if (order && order.status !== 'completed') {
      const { count } = await r.db.from('voice_order_versions').select('id', { count: 'exact', head: true }).eq('voice_order_id', order.id);
      firstDelivery = (count || 0) === 0;
      await r.db.from('voice_order_versions').insert({
        voice_order_id: order.id, file_url: deliveryUrl, file_name: deliveryName,
        notes: '配音員交付', version_number: (count || 0) + 1, status: 'pending_review',
      });
      await r.db.from('voice_orders').update({ download_url: deliveryUrl, status: 'delivered', updated_at: new Date().toISOString() }).eq('id', order.id);
      if (order.email && firstDelivery) {
        const cnote = castingDeliveryClientEmail({ title: (order.order_number as string) || '', orderNumber: order.order_number as string, url: `${SITE}/dashboard/orders/${order.id}` });
        sendEmail({ category: 'PRODUCTION', to: order.email as string, subject: cnote.subject, html: cnote.html }).catch(() => {});
      }
    }

    // Notify Onyx production too (oversight, best-effort).
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
