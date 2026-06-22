import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient, supabaseErrorResponse } from '@/lib/supabase-server';

/*
  Talent's OWN earnings/payouts. Authenticated by the talent's Supabase session
  (Bearer access token) and scoped to their own talents row via auth_user_id — a
  talent can only ever see their own money. Real data from talent_earnings; the
  talent never sees the order's real total or internal cost, only their share.
*/

export async function GET(request: NextRequest) {
  try {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const db = getSupabaseServiceClient();
    const { data: userData, error: userErr } = await db.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });

    const { data: talent } = await db
      .from('talents')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (!talent) return NextResponse.json({ error: 'No talent profile linked' }, { status: 404 });

    // Only the columns the talent should see — their cut, the type, status, date.
    const { data: rows, error } = await db
      .from('talent_earnings')
      .select('id, order_type, commission_amount, status, created_at')
      .eq('talent_id', talent.id)
      .order('created_at', { ascending: false });
    if (error) {
      // Table may not exist on a fresh DB — degrade gracefully to an empty list.
      return NextResponse.json({ earnings: [], totals: { paid: 0, pending: 0, total: 0 } });
    }

    const earnings = rows || [];
    const sum = (pred: (s: string) => boolean) =>
      Math.round(earnings.filter((e) => pred(e.status || '')).reduce((a, e) => a + (Number(e.commission_amount) || 0), 0) * 100) / 100;
    const totals = {
      paid: sum((s) => s === 'paid'),
      pending: sum((s) => s !== 'paid'),
      total: Math.round(earnings.reduce((a, e) => a + (Number(e.commission_amount) || 0), 0) * 100) / 100,
    };

    return NextResponse.json({ earnings, totals });
  } catch (err) {
    return supabaseErrorResponse(err, 'api/talent/earnings:GET');
  }
}
