import { NextRequest, NextResponse } from 'next/server';
import { resolveTalentFromRequest } from '@/lib/talent-auth';
import { encryptJson, decryptJson, payoutEncConfigured } from '@/lib/payout-crypto';

/*
  GET/PUT /api/talent/payout-details — the talent manages their OWN payout details
  (session-scoped). Stored encrypted in the restricted talent_payout_details table.

  Two tracks:
   - region 'TW'  → bank_transfer 勞務報酬: legal_name, national_id, address,
     bank_name, bank_branch, bank_account_name, bank_account.
   - region 'overseas' → paypal: legal_name, paypal_email (talent invoices us per pay).
*/

const S = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function GET(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (!payoutEncConfigured()) return NextResponse.json({ configured: false }, { status: 200 });

  const { data } = await r.db.from('talent_payout_details').select('region, payout_method, enc_payload, completed').eq('talent_id', (r.talent as { id: string }).id).maybeSingle();
  let details: Record<string, unknown> = {};
  if (data?.enc_payload) {
    try { details = decryptJson(data.enc_payload as string); } catch { details = {}; }
  }
  return NextResponse.json({
    configured: true,
    region: data?.region || '',
    payout_method: data?.payout_method || '',
    completed: !!data?.completed,
    details,
  });
}

export async function PUT(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (!payoutEncConfigured()) return NextResponse.json({ error: 'payout_enc_unconfigured' }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const region = body.region === 'overseas' ? 'overseas' : body.region === 'TW' ? 'TW' : '';
  if (!region) return NextResponse.json({ error: '請選擇收款地區 (台灣 / 國外)' }, { status: 400 });
  const d = (body.details && typeof body.details === 'object' ? body.details : {}) as Record<string, unknown>;

  let payload: Record<string, string>;
  let method: string;
  if (region === 'TW') {
    method = 'bank_transfer';
    payload = {
      legal_name: S(d.legal_name, 120),
      national_id: S(d.national_id, 40),
      address: S(d.address, 300),
      bank_name: S(d.bank_name, 120),
      bank_branch: S(d.bank_branch, 120),
      bank_account_name: S(d.bank_account_name, 120),
      bank_account: S(d.bank_account, 60),
    };
    const missing = ['legal_name', 'national_id', 'address', 'bank_name', 'bank_account_name', 'bank_account'].filter((k) => !payload[k]);
    if (missing.length) return NextResponse.json({ error: 'incomplete', missing }, { status: 400 });
  } else {
    method = 'paypal';
    payload = { legal_name: S(d.legal_name, 120), paypal_email: S(d.paypal_email, 200) };
    if (!payload.legal_name || !payload.paypal_email) return NextResponse.json({ error: 'incomplete', missing: ['legal_name', 'paypal_email'].filter((k) => !payload[k]) }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.paypal_email)) return NextResponse.json({ error: 'PayPal Email 格式不正確' }, { status: 400 });
  }

  const enc_payload = encryptJson(payload);
  const { error } = await r.db.from('talent_payout_details').upsert({
    talent_id: (r.talent as { id: string }).id,
    region, payout_method: method, enc_payload, completed: true, updated_at: new Date().toISOString(),
  }, { onConflict: 'talent_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, region, payout_method: method, completed: true });
}
