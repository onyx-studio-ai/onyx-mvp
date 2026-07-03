import { NextRequest, NextResponse } from 'next/server';
import { resolveTalentFromRequest } from '@/lib/talent-auth';
import { encryptJson, decryptJson, payoutEncConfigured } from '@/lib/payout-crypto';
import { validatePayout, type PayoutInput } from '@/lib/payout-validation';

/*
  GET/PUT /api/talent/payout-details — the talent manages their OWN payout details
  (session-scoped), stored encrypted in the restricted talent_payout_details table.

  Organised by PAYMENT METHOD (not region), anyone worldwide:
   - method 'bank'   → account holder, bank name, bank country, account no / IBAN,
     SWIFT/BIC (required when the bank is outside Taiwan), branch.
   - method 'paypal' → account holder + PayPal email (talent invoices us per payout).

  Tax profile (drives withholding, shown to Onyx for payout):
   - tax_location 'overseas' → no Taiwan tax.
   - tax_location 'TW' + tw_resident → resident rules (10%+NHI over NT$20,000).
   - tax_location 'TW' + non-resident → 20% withholding.
   TW cases also collect national_id + address for the 扣繳憑單.
*/

const S = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function GET(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (!payoutEncConfigured()) return NextResponse.json({ configured: false }, { status: 200 });

  const { data } = await r.db.from('talent_payout_details').select('region, payout_method, enc_payload, completed').eq('talent_id', (r.talent as { id: string }).id).maybeSingle();
  let details: Record<string, unknown> = {};
  if (data?.enc_payload) { try { details = decryptJson(data.enc_payload as string); } catch { details = {}; } }
  return NextResponse.json({
    configured: true,
    method: data?.payout_method || '',
    tax_location: data?.region || '',
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

  const method = body.method === 'bank' ? 'bank' : body.method === 'paypal' ? 'paypal' : '';
  if (!method) return NextResponse.json({ error: '請選擇收款方式(銀行匯款 / PayPal)' }, { status: 400 });
  const d = (body.details && typeof body.details === 'object' ? body.details : {}) as Record<string, unknown>;

  // ── Tax profile (common to both methods) ──
  const taxLocation = d.tax_location === 'TW' ? 'TW' : d.tax_location === 'overseas' ? 'overseas' : '';
  if (!taxLocation) return NextResponse.json({ error: '請選擇稅務所在地(台灣 / 海外)' }, { status: 400 });
  const twResident = taxLocation === 'TW' ? d.tw_resident === true || d.tw_resident === 'true' : false;

  const payload: Record<string, string | boolean> = {
    method,
    account_holder: S(d.account_holder, 120),
    tax_location: taxLocation,
    tw_resident: twResident,
  };

  if (method === 'bank') {
    payload.bank_name = S(d.bank_name, 120);
    payload.bank_country = S(d.bank_country, 60).toUpperCase();
    payload.account_number = S(d.account_number, 60);
    payload.iban = S(d.iban, 60).toUpperCase();
    payload.swift = S(d.swift, 30).toUpperCase();
    payload.bank_code = S(d.bank_code, 20);   // 台灣 7 碼分行代碼
    payload.bank_branch = S(d.bank_branch, 120);
  } else {
    payload.paypal_email = S(d.paypal_email, 200);
  }
  if (taxLocation === 'TW') {
    payload.national_id = S(d.national_id, 40).toUpperCase();
    payload.tax_address = S(d.tax_address, 300);
  }

  // 嚴格驗證(格式/長度)—— 亂填擋下,回具體欄位錯誤。匯錯錢很麻煩,寧可先擋。
  const errs = validatePayout(payload as unknown as PayoutInput);
  if (errs.length) return NextResponse.json({ error: 'invalid', fields: errs }, { status: 400 });

  const enc_payload = encryptJson(payload);
  const { error } = await r.db.from('talent_payout_details').upsert({
    talent_id: (r.talent as { id: string }).id,
    region: taxLocation, payout_method: method, enc_payload, completed: true, updated_at: new Date().toISOString(),
  }, { onConflict: 'talent_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, method, tax_location: taxLocation, completed: true });
}
