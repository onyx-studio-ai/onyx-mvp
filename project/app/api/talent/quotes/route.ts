import { NextRequest, NextResponse } from 'next/server';
import { resolveTalentFromRequest } from '@/lib/talent-auth';
import { sendEmail } from '@/lib/mail';

/*
  POST /api/talent/quotes — a talent submits a quote on an open brief.

  Money model: the talent enters the GROSS amount the client would pay; the DB
  derives their NET take-home (gross × (1 − commission_rate)). commission_rate
  defaults to 0.20 (the onboarding-agreed rate). The talent always sees NET.

  Onyx is notified (system email) so it can mediate the award (managed model).
  DELETE — withdraw an active quote.
*/

const CURRENCIES = ['USD', 'TWD', 'HKD', 'CNY', 'EUR', 'GBP', 'JPY', 'SGD'];

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

    if (!briefId) return NextResponse.json({ error: 'brief_id is required' }, { status: 400 });
    if (!isFinite(gross) || gross <= 0) return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });

    // Brief must exist and be open.
    const { data: brief } = await r.db
      .from('marketplace_briefs')
      .select('id, brief_number, status')
      .eq('id', briefId)
      .maybeSingle();
    if (!brief) return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
    if (brief.status !== 'open') return NextResponse.json({ error: 'This brief is no longer open' }, { status: 400 });

    const { data, error } = await r.db
      .from('marketplace_quotes')
      .insert({ brief_id: briefId, talent_id: talent.id, gross_amount: gross, currency, message })
      .select('id, gross_amount, net_amount, commission_rate, currency, status')
      .single();
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'You already have an active quote on this brief' }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notify Onyx so it can review + mediate (best-effort).
    sendEmail({
      category: 'PRODUCTION',
      to: 'produce@onyxstudios.ai',
      subject: `新報價 ${brief.brief_number} — ${talent.name}`,
      html: `<p>配音員 <b>${talent.name}</b> 對 brief <b>${brief.brief_number}</b> 報價:</p>
             <p>客戶支付 ${currency} ${gross} · 配音員淨得 ${currency} ${data.net_amount}</p>
             ${message ? `<p style="white-space:pre-wrap;background:#f4f4f5;padding:10px;border-radius:8px;">${message.replace(/[<>&]/g, '')}</p>` : ''}`,
    }).catch(() => {});

    return NextResponse.json({ quote: data });
  } catch (err) {
    console.error('[talent/quotes] POST error:', err);
    return NextResponse.json({ error: 'Could not submit quote' }, { status: 500 });
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
