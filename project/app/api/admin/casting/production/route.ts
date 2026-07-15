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
  // voice_orders.talent_id 沒有 FK,不能用 PostgREST 的 talents(name) 關聯查詢(會整包炸)
  // → 兩步查詢自己拼名字。
  const [{ data: brief }, { data: orders }] = await Promise.all([
    db.from('marketplace_briefs').select('id, title, brief_number, status').eq('id', briefId).maybeSingle(),
    db.from('voice_orders')
      .select('id, order_number, role_name, talent_id, status, script_text, production_notes, reference_files, voice_sample_files, role_images, talent_price, price, pay_unit, pay_rate, currency, deadline, released_at, created_at')
      .eq('brief_id', briefId)
      .order('created_at', { ascending: true }),
  ]);
  if (!brief) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const tIds = [...new Set((orders || []).map((o) => o.talent_id).filter(Boolean))] as string[];
  const nameById = new Map<string, string>();
  if (tIds.length) {
    const { data: ts } = await db.from('talents').select('id, name').in('id', tIds);
    for (const t of ts || []) nameById.set(String(t.id), String(t.name || ''));
  }
  const flat = (orders || []).map((o) => ({ ...o, talent_name: nameById.get(String(o.talent_id)) || null }));
  return NextResponse.json({ brief, orders: flat });
}
