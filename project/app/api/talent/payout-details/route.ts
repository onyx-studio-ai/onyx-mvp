import { NextRequest, NextResponse } from 'next/server';
import { resolveTalentFromRequest } from '@/lib/talent-auth';
import { encryptJson, decryptJson, payoutEncConfigured } from '@/lib/payout-crypto';
import { validatePayout, hasTwd, hasUsd, type PayoutInput } from '@/lib/payout-validation';

/*
  GET/PUT /api/talent/payout-details — 配音員自己的收款資料(session-scoped),加密存
  於受限表 talent_payout_details。兩組結構(台灣人台幣戶 / 外幣戶是不同帳號):
    twd = 台幣收款(台灣本地銀行);usd = 美金收款(外幣銀行 或 PayPal)。至少填一組。
  稅務(tax)共用一份 —— 海外免台灣稅;台灣居住者/非居住者分別扣繳。
*/

const S = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export async function GET(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (!payoutEncConfigured()) return NextResponse.json({ configured: false }, { status: 200 });

  const { data } = await r.db.from('talent_payout_details').select('enc_payload, completed').eq('talent_id', (r.talent as { id: string }).id).maybeSingle();
  let p: Record<string, unknown> = {};
  if (data?.enc_payload) { try { p = decryptJson(data.enc_payload as string); } catch { p = {}; } }
  return NextResponse.json({ configured: true, twd: p.twd || null, usd: p.usd || null, tax: p.tax || {}, completed: !!data?.completed });
}

export async function PUT(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (!payoutEncConfigured()) return NextResponse.json({ error: 'payout_enc_unconfigured' }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const tin = obj(body.twd), uin = obj(body.usd), tax = obj(body.tax);
  const twd = { account_holder: S(tin.account_holder, 120), bank_name: S(tin.bank_name, 120), bank_branch: S(tin.bank_branch, 120), bank_code: S(tin.bank_code, 20), account_number: S(tin.account_number, 60) };
  const usd = { method: uin.method === 'paypal' ? 'paypal' : 'bank', account_holder: S(uin.account_holder, 120), bank_name: S(uin.bank_name, 120), bank_address: S(uin.bank_address, 200), swift: S(uin.swift, 30).toUpperCase(), iban: S(uin.iban, 60).toUpperCase(), account_number: S(uin.account_number, 60), paypal_email: S(uin.paypal_email, 200) };
  const taxLocation = tax.tax_location === 'TW' ? 'TW' : tax.tax_location === 'overseas' ? 'overseas' : '';
  const twResident = taxLocation === 'TW' ? (tax.tw_resident === true || tax.tw_resident === 'true') : false;
  const nationalId = S(tax.national_id, 40).toUpperCase();
  const taxAddress = S(tax.tax_address, 300);
  const taxId = S(tax.tax_id, 40).toUpperCase();   // 稅籍編號(選填):台灣可填身分證,海外填 Tax ID;有填才置入發票賣方欄

  const forVal: PayoutInput = { twd, usd, tax_location: taxLocation, tw_resident: twResident, national_id: nationalId, tax_address: taxAddress };
  const errs = validatePayout(forVal);
  if (errs.length) return NextResponse.json({ error: 'invalid', fields: errs }, { status: 400 });

  const useTwd = hasTwd(forVal), useUsd = hasUsd(forVal);
  const payload = { twd: useTwd ? twd : null, usd: useUsd ? usd : null, tax: { tax_location: taxLocation, tw_resident: twResident, national_id: nationalId, tax_address: taxAddress, tax_id: taxId } };
  const method = [useTwd ? 'twd' : '', useUsd ? (usd.method === 'paypal' ? 'usd_paypal' : 'usd_bank') : ''].filter(Boolean).join(',');

  const { error } = await r.db.from('talent_payout_details').upsert({
    talent_id: (r.talent as { id: string }).id,
    region: taxLocation, payout_method: method, enc_payload: encryptJson(payload), completed: true, updated_at: new Date().toISOString(),
  }, { onConflict: 'talent_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, completed: true });
}
