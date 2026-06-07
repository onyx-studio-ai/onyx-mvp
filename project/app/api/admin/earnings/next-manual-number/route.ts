import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminOnly } from '@/app/api/admin/_utils/requireAdmin';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * GET /api/admin/earnings/next-manual-number?subtype=client_deal|buyout
 *
 * Returns the next available manual order_number, formatted as
 * `MANUAL-{YEAR}-{NNN}` (for client_deal) or `BUYOUT-{YEAR}-{NNN}`
 * (for buyout), zero-padded to 3 digits.
 *
 * 2026-06-07 Wing reported the original modal asked her to invent
 * the order number herself with only a placeholder hint — she'd have
 * to remember whether last entry was 003 or 007. This endpoint
 * powers the modal's auto-fill so she opens it and the next number
 * is already there (still editable for the 1% case she wants a
 * custom slug like SIERRA-Q3).
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const subtypeParam = searchParams.get('subtype');
  const subtype = subtypeParam === 'buyout' ? 'buyout' : 'client_deal';
  const prefix = subtype === 'buyout' ? 'BUYOUT' : 'MANUAL';
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-`;

  const supabase = getAdminClient();
  // Pull every manual-typed earning whose order_number starts with the
  // {PREFIX}-{YEAR}- prefix. Tier filtering keeps us out of unrelated
  // platform orders (tier='manual' for client_deal, tier='buyout' for
  // buyout) and means a future schema rename won't pollute the count.
  const { data, error } = await supabase
    .from('talent_earnings')
    .select('order_number')
    .eq('order_type', 'manual')
    .like('order_number', `${pattern}%`);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let maxSeq = 0;
  for (const row of data || []) {
    const suffix = row.order_number?.slice(pattern.length);
    const n = parseInt(suffix || '', 10);
    if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
  }

  const next = String(maxSeq + 1).padStart(3, '0');
  return NextResponse.json({ nextNumber: `${prefix}-${year}-${next}` });
}
