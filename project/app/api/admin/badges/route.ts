import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const supabase = getAdminClient();
    const { searchParams } = new URL(request.url);

    const ordersSince = searchParams.get('orders_since');
    const inquiriesSince = searchParams.get('inquiries_since');
    const applicationsSince = searchParams.get('applications_since');
    const requestsSince = searchParams.get('requests_since');
    const demosSince = searchParams.get('demos_since');

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

    // Pending client requests = /hire casting briefs awaiting Onyx review (a real
    // client, not Onyx's own casting@ posts). Gives 客戶請求 an unread badge so new
    // requests aren't missed.
    let requestsQuery = supabase
      .from('marketplace_briefs')
      .select('*', { count: 'exact', head: true })
      .eq('kind', 'casting')
      .eq('status', 'reviewing')
      .neq('client_email', 'casting@onyxstudios.ai');
    if (requestsSince) requestsQuery = requestsQuery.gt('created_at', requestsSince);

    // New "extra demos" a talent uploaded in response to a 想聽更多 demo request.
    // extra_samples_updated_at is stamped on each upload, so this counts quotes
    // that got a new clip since the boss last opened 案件 · 發案.
    let demosQuery = supabase
      .from('marketplace_quotes')
      .select('*', { count: 'exact', head: true })
      .not('extra_samples_updated_at', 'is', null);
    if (demosSince) demosQuery = demosQuery.gt('extra_samples_updated_at', demosSince);

    let orchestraUrl = `${SUPABASE_URL}/rest/v1/orchestra_orders?status=eq.paid&select=id`;
    if (ordersSince) orchestraUrl += `&created_at=gt.${ordersSince}`;

    const [
      { count: paidVoice },
      { count: paidMusic },
      { count: newInquiries },
      { count: pendingApps },
      { count: pendingRequests },
      { count: newDemos },
      orchestraRes,
    ] = await Promise.all([
      voiceQuery,
      musicQuery,
      inquiriesQuery,
      appsQuery,
      requestsQuery,
      demosQuery,
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
      requests: pendingRequests || 0,
      demos: newDemos || 0,
    });
  } catch (err) {
    console.error('[Admin Badges] Error:', err);
    return NextResponse.json({ inquiries: 0, orders: 0, applications: 0, requests: 0, demos: 0 });
  }
}
