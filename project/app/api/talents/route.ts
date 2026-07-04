import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient, supabaseErrorResponse } from '@/lib/supabase-server';

// PUBLIC endpoint (no auth) — 只回前台卡片需要的公開欄位白名單。
// 絕不 select('*'):那會把 email / phone / country / expected_rates /
// payment_method / payment_details / voice_id_*(身分證號 / 檔案 URL / 簽名 URL)/
// auth_user_id / application_id / internal_cost / portfolio_url(內部參考) 等
// PII / 收款 / 授權綁定資料一起回給任何人。frontend_price 在伺服器端算完才回。
// 需要這些敏感欄位的 admin 工具,請直接用 service_role 查 talents 表,別打此端點。
const PUBLIC_CARD_COLS = [
  'id',
  'name',
  'english_name',
  'type',
  'category',
  'gender',
  'accent',
  'headshot_url',
  'sample_url',
  'demo_urls',
  'languages',
  'tags',
  'bio',
  'voice_traits',
  'specialties',
  'is_active',
  'sort_order',
  // internal_cost 只用來在伺服器端算 frontend_price(見下方 map),不回給前端。
  'internal_cost',
  'frontend_price',
].join(', ');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get('type') || 'singer';

    const db = getSupabaseServiceClient();

    // PUBLIC endpoint — only return talents that have completed Voice ID
    // verification. Otherwise placeholder/unverified talents leak onto the
    // public catalogue (the homepage /voices wall, /music/talents singer
    // grid, etc.) where customers can click into a non-deliverable order.
    // To intentionally surface unverified talents (for admin tools), use a
    // service-role query against the `talents` table directly instead of
    // calling this endpoint.
    let query = db
      .from('talents')
      .select(PUBLIC_CARD_COLS)
      .eq('is_active', true)
      .eq('voice_id_status', 'verified')
      .order('sort_order', { ascending: true });

    if (typeParam.toLowerCase() === 'all') {
      // no type filter
    } else if (typeParam.toLowerCase() === 'vo' || typeParam.toLowerCase() === 'voice_actor') {
      query = query.in('type', ['VO', 'voice_actor']);
    } else {
      const type = typeParam.charAt(0).toUpperCase() + typeParam.slice(1).toLowerCase();
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[talents] DB error:', error);
      return NextResponse.json({ error: 'Failed to fetch talents' }, { status: 500 });
    }

    // internal_cost 只用來在此算 frontend_price 的 fallback,絕不回給前端 → 解構丟掉。
    const talents = (data || []).map((t: any) => {
      const { internal_cost, ...rest } = t;
      return {
        ...rest,
        frontend_price: t.frontend_price || (internal_cost != null ? internal_cost * 1.6 : null),
      };
    });

    return NextResponse.json(talents);
  } catch (err) {
    return supabaseErrorResponse(err, 'api/talents');
  }
}
