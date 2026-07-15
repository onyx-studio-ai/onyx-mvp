import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  GET /api/admin/casting/production?brief_id=… — 製作管理頁的資料:
  該案(brief)+ 全部角色製作單(含配音員名),給 /admin/casting/[id]/production 用。
*/
export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const briefId = new URL(request.url).searchParams.get('brief_id') || '';
  if (!briefId) return NextResponse.json({ error: 'missing brief_id' }, { status: 400 });

  const db = getSupabaseServiceClient();
  const [{ data: brief }, { data: orders }] = await Promise.all([
    db.from('marketplace_briefs').select('id, title, brief_number, status').eq('id', briefId).maybeSingle(),
    db.from('voice_orders')
      .select('id, order_number, role_name, talent_id, status, script_text, reference_files, talent_price, price, currency, deadline, created_at, talents(name)')
      .eq('brief_id', briefId)
      .order('created_at', { ascending: true }),
  ]);
  if (!brief) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const flat = (orders || []).map((o) => {
    const t = o.talents as { name?: string } | { name?: string }[] | null;
    const talent_name = Array.isArray(t) ? t[0]?.name : t?.name;
    const { talents: _drop, ...rest } = o as Record<string, unknown>;
    return { ...rest, talent_name: talent_name || null };
  });
  return NextResponse.json({ brief, orders: flat });
}
