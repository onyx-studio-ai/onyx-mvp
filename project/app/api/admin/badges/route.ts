import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getAdminClient();
    const { searchParams } = new URL(request.url);

    const ordersSince = searchParams.get('orders_since');
    const inquiriesSince = searchParams.get('inquiries_since');
    const applicationsSince = searchParams.get('applications_since');

    let voiceQuery = supabase
      .from('voice_orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'paid');
    if (ordersSince) voiceQuery = voiceQuery.gt('created_at', ordersSince);

    let musicQuery = supabase
      .from('music_orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'paid');
    if (ordersSince) musicQuery = musicQuery.gt('created_at', ordersSince);

    let inquiriesQuery = supabase
      .from('contact_inquiries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new');
    if (inquiriesSince) inquiriesQuery = inquiriesQuery.gt('created_at', inquiriesSince);

    let appsQuery = supabase
      .from('talent_applications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (applicationsSince) appsQuery = appsQuery.gt('created_at', applicationsSince);

    let orchestraUrl = `${SUPABASE_URL}/rest/v1/orchestra_orders?status=eq.paid&select=id`;
    if (ordersSince) orchestraUrl += `&created_at=gt.${ordersSince}`;

    const [
      { count: paidVoice },
      { count: paidMusic },
      { count: newInquiries },
      { count: pendingApps },
      orchestraRes,
    ] = await Promise.all([
      voiceQuery,
      musicQuery,
      inquiriesQuery,
      appsQuery,
      fetch(orchestraUrl, {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }).then(r => r.json()).catch(() => []),
    ]);

    const orchestraPaid = Array.isArray(orchestraRes) ? orchestraRes.length : 0;

    return NextResponse.json({
      orders: (paidVoice || 0) + (paidMusic || 0) + orchestraPaid,
      inquiries: newInquiries || 0,
      applications: pendingApps || 0,
    });
  } catch (err) {
    console.error('[Admin Badges] Error:', err);
    return NextResponse.json({ inquiries: 0, orders: 0, applications: 0 });
  }
}
