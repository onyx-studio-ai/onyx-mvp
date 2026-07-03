import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOnly } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';
import { decryptJson, payoutEncConfigured } from '@/lib/payout-crypto';

/*
  GET /api/admin/payout-details?talent_id=... — decrypt a talent's payout details
  for Wing to pay them. Admin-role only (national ID / bank account = most sensitive
  data on the platform). Fetched on demand per talent, never bulk, so plaintext PII
  is only ever materialised when Wing actually opens that row.
*/
export async function GET(request: NextRequest) {
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;
  if (!payoutEncConfigured()) return NextResponse.json({ error: 'payout_enc_unconfigured' }, { status: 503 });

  const talentId = new URL(request.url).searchParams.get('talent_id') || '';
  if (!talentId) return NextResponse.json({ error: 'talent_id required' }, { status: 400 });

  const db = getSupabaseServiceClient();
  const { data } = await db.from('talent_payout_details').select('region, payout_method, enc_payload, completed, updated_at').eq('talent_id', talentId).maybeSingle();
  if (!data) return NextResponse.json({ found: false });

  let details: Record<string, unknown> = {};
  if (data.enc_payload) {
    try { details = decryptJson(data.enc_payload as string); } catch { return NextResponse.json({ error: 'decrypt_failed' }, { status: 500 }); }
  }
  return NextResponse.json({ found: true, region: data.region, payout_method: data.payout_method, completed: data.completed, updated_at: data.updated_at, details });
}
