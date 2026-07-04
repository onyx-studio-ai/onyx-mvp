import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  後台左側導覽的「待處理數量」徽章 — 一次把各項待處理 count 拿回來,
  讓老闆一進後台就看到哪裡有新東西要處理,不用逐個點進去。

  全部用 head:true, count:'exact' 的輕量 count query(只回筆數,不拉整表)。

  授權:沿用 requireAdmin(admin + production 兩種後台角色都可讀)。
  ⚠️ 這裡刻意不用 requireAdminOnly:production 角色的導覽也有
     訂單/詢問/申請三顆徽章,用 requireAdminOnly 會讓 production 直接 403、
     退化掉現有可用的徽章。而較敏感的兩顆(請款單/報價)本來就只有 admin 角色
     的導覽才會出現(production 的導覽被 PRODUCTION_ALLOWED_HREFS 濾掉),
     不會外洩給 production。

  各項「待處理」定義:
   - orders       訂單:voice/music/orchestra 三張訂單表 status='paid'(已付款待處理)
   - inquiries    詢問單:contact_inquiries status='new'(新進未處理)
   - applications 申請資料:talent_applications status='pending'(待審)
   - requests     客戶請求:marketplace_briefs kind='casting' status='reviewing'
                  且非本站自家 casting@ 貼文(真客戶從 /hire 送來、待我方審核發佈)
   - payouts      請款單:payout_requests status='invoice_uploaded'(配音員已上傳發票、待撥款)
   - casting      案件·發案:marketplace_quotes status='submitted'(配音員新投的報價/試音、待看)

  可選的 *_since 參數(ISO 時間字串):只數該時間之後新增的,用於前端
  「開過該頁就清零」的 markSeen 機制(沿用原 /api/admin/badges 行為)。
*/

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const db = getSupabaseServiceClient();
    const { searchParams } = new URL(request.url);
    const since = (key: string) => searchParams.get(`${key}_since`);

    const ordersSince = since('orders');
    const inquiriesSince = since('inquiries');
    const applicationsSince = since('applications');
    const requestsSince = since('requests');
    const payoutsSince = since('payouts');
    const castingSince = since('casting');

    // --- 訂單:三張訂單表都算已付款(paid)的 ---
    let voiceQuery = db.from('voice_orders').select('*', { count: 'exact', head: true }).eq('status', 'paid');
    if (ordersSince) voiceQuery = voiceQuery.gt('created_at', ordersSince);

    let musicQuery = db.from('music_orders').select('*', { count: 'exact', head: true }).eq('status', 'paid');
    if (ordersSince) musicQuery = musicQuery.gt('created_at', ordersSince);

    // orchestra_orders 用 REST 直打(維持與舊 badges 路由一致的降級容錯:表可能未建)
    let orchestraUrl = `${SUPABASE_URL}/rest/v1/orchestra_orders?status=eq.paid&select=id`;
    if (ordersSince) orchestraUrl += `&created_at=gt.${ordersSince}`;

    // --- 詢問單:新進未處理 ---
    let inquiriesQuery = db.from('contact_inquiries').select('*', { count: 'exact', head: true }).eq('status', 'new');
    if (inquiriesSince) inquiriesQuery = inquiriesQuery.gt('created_at', inquiriesSince);

    // --- 申請資料:待審 ---
    let appsQuery = db.from('talent_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending');
    if (applicationsSince) appsQuery = appsQuery.gt('created_at', applicationsSince);

    // --- 客戶請求:真客戶送來、待我方審核發佈的 /hire 需求 ---
    let requestsQuery = db.from('marketplace_briefs')
      .select('*', { count: 'exact', head: true })
      .eq('kind', 'casting')
      .eq('status', 'reviewing')
      .neq('client_email', 'casting@onyxstudios.ai');
    if (requestsSince) requestsQuery = requestsQuery.gt('created_at', requestsSince);

    // --- 請款單:配音員已上傳發票、待撥款 ---
    let payoutsQuery = db.from('payout_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'invoice_uploaded');
    if (payoutsSince) payoutsQuery = payoutsQuery.gt('created_at', payoutsSince);

    // --- 案件·發案:配音員新投的報價/試音、待看 ---
    let castingQuery = db.from('marketplace_quotes')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'submitted');
    if (castingSince) castingQuery = castingQuery.gt('created_at', castingSince);

    const [
      { count: paidVoice },
      { count: paidMusic },
      { count: newInquiries },
      { count: pendingApps },
      { count: pendingRequests },
      { count: pendingPayouts },
      { count: newQuotes },
      orchestraRes,
    ] = await Promise.all([
      voiceQuery,
      musicQuery,
      inquiriesQuery,
      appsQuery,
      requestsQuery,
      payoutsQuery,
      castingQuery,
      fetch(orchestraUrl, {
        headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      }).then((r) => r.json()).catch(() => []),
    ]);

    const orchestraPaid = Array.isArray(orchestraRes) ? orchestraRes.length : 0;

    return NextResponse.json({
      orders: (paidVoice || 0) + (paidMusic || 0) + orchestraPaid,
      inquiries: newInquiries || 0,
      applications: pendingApps || 0,
      requests: pendingRequests || 0,
      payouts: pendingPayouts || 0,
      casting: newQuotes || 0,
    });
  } catch (err) {
    console.error('[Admin Nav Counts] Error:', err);
    return NextResponse.json({ orders: 0, inquiries: 0, applications: 0, requests: 0, payouts: 0, casting: 0 });
  }
}
