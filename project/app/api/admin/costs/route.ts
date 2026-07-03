import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOnly } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient, supabaseErrorResponse } from '@/lib/supabase-server';

/*
  營運工具 / 每月費用清單 CRUD。
  - GET    列出所有 platform_costs(依 sort_order, name)
  - POST   新增一筆(name 必填)
  - PATCH  依 id 更新(帶到的欄位才更新;updated_at = now())
  - DELETE 依 ?id= 刪除(連同該工具的發票紀錄)

  費用是財務資料 → 用 requireAdminOnly(production 角色擋掉),與 payouts 一致。
*/

// 只允許更新/寫入這些欄位,避免前端亂塞 id / created_at。
const CURRENCIES = new Set(['TWD', 'USD']);
const BILLING = new Set(['monthly', 'yearly', 'usage', 'free']);
const STATUSES = new Set(['active', 'review', 'inactive']);

function str(v: unknown, max = 500): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

/** 把前端送來的 body 清成一組安全欄位。partial=true 時只回傳有帶到的鍵(給 PATCH)。 */
function sanitize(body: Record<string, unknown>, partial: boolean) {
  const out: Record<string, unknown> = {};
  const set = (key: string, val: unknown) => {
    if (partial && !(key in body)) return; // PATCH:沒帶的欄位不動
    out[key] = val;
  };

  if ('name' in body || !partial) set('name', str(body.name, 200));
  if ('category' in body || !partial) set('category', str(body.category, 100));
  if ('plan' in body || !partial) set('plan', str(body.plan, 100));

  if ('monthly_cost' in body || !partial) {
    const n = body.monthly_cost;
    set('monthly_cost', n === '' || n == null ? null : (Number.isFinite(Number(n)) ? Number(n) : null));
  }
  if ('currency' in body || !partial) {
    const c = str(body.currency, 8);
    set('currency', c && CURRENCIES.has(c) ? c : 'USD');
  }
  if ('billing_cycle' in body || !partial) {
    const b = str(body.billing_cycle, 16);
    set('billing_cycle', b && BILLING.has(b) ? b : 'monthly');
  }
  if ('status' in body || !partial) {
    const s = str(body.status, 16);
    set('status', s && STATUSES.has(s) ? s : 'active');
  }
  set('renewal_date', str(body.renewal_date, 120));
  set('url', str(body.url, 500));
  set('note', str(body.note, 2000));
  if ('sort_order' in body || !partial) {
    const so = Number(body.sort_order);
    set('sort_order', Number.isFinite(so) ? Math.trunc(so) : 0);
  }
  return out;
}

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;

  try {
    const db = getSupabaseServiceClient();
    const { data, error } = await db
      .from('platform_costs')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  } catch (err) {
    return supabaseErrorResponse(err, 'admin/costs GET');
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => ({}));
    const clean = sanitize(body, false);
    if (!clean.name) return NextResponse.json({ error: '請填工具名稱' }, { status: 400 });

    const db = getSupabaseServiceClient();
    const { data, error } = await db.from('platform_costs').insert([clean]).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    return supabaseErrorResponse(err, 'admin/costs POST');
  }
}

export async function PATCH(request: NextRequest) {
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => ({}));
    const id = str(body.id, 64);
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const clean = sanitize(body, true);
    if ('name' in clean && !clean.name) return NextResponse.json({ error: '工具名稱不可空白' }, { status: 400 });
    clean.updated_at = new Date().toISOString();

    const db = getSupabaseServiceClient();
    const { error } = await db.from('platform_costs').update(clean).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return supabaseErrorResponse(err, 'admin/costs PATCH');
  }
}

export async function DELETE(request: NextRequest) {
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const db = getSupabaseServiceClient();
    // 先刪該工具的發票紀錄(無外鍵約束,手動清乾淨),再刪工具本身。
    await db.from('platform_cost_invoices').delete().eq('cost_id', id);
    const { error } = await db.from('platform_costs').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return supabaseErrorResponse(err, 'admin/costs DELETE');
  }
}
