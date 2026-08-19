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
    db.from('marketplace_briefs').select('id, title, brief_number, status, timezone').eq('id', briefId).maybeSingle(),
    db.from('voice_orders')
      .select('id, order_number, role_name, talent_id, status, script_text, script_files, production_notes, reference_files, voice_sample_files, role_images, revision_note, revision_files, revision_count, talent_price, price, pay_unit, pay_rate, currency, deadline, deadline_time, released_at, created_at')
      .eq('brief_id', briefId)
      .order('created_at', { ascending: true }),
  ]);
  if (!brief) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const tIds = [...new Set((orders || []).map((o) => o.talent_id).filter(Boolean))] as string[];
  const nameById = new Map<string, string>();
  type TInfo = { id: string; name?: string | null; phone?: string | null; line_user_id?: string | null; telegram_chat_id?: string | null };
  const infoById = new Map<string, TInfo>();
  if (tIds.length) {
    const { data: ts } = await db.from('talents').select('id, name, phone, line_user_id, telegram_chat_id').in('id', tIds);
    for (const t of (ts || []) as TInfo[]) { nameById.set(String(t.id), String(t.name || '')); infoById.set(String(t.id), t); }
  }
  // 配音員實際交了什麼 —— 這頁原本只有「發修改需求」按鈕,看不到交付檔,
  // 導致「配音員明明交了、後台卻像沒收到」(2026-08-19 茹芸 A422 修改版)。
  // 一張單可能有多個不同的檔(多支影片),同檔名只留最新一版(照 created_at)。
  const orderIds = (orders || []).map((o) => o.id as string);
  const delivByOrder: Record<string, { file_name: string; file_url: string; created_at: string; status?: string | null }[]> = {};
  if (orderIds.length) {
    const { data: vers } = await db.from('voice_order_versions')
      .select('voice_order_id, file_name, file_url, created_at, status')
      .in('voice_order_id', orderIds)
      .order('created_at', { ascending: true });
    const latest = new Map<string, { file_name: string; file_url: string; created_at: string; status?: string | null }>();
    for (const v of vers || []) {
      latest.set(`${v.voice_order_id}\u0000${v.file_name}`, { file_name: String(v.file_name), file_url: String(v.file_url), created_at: String(v.created_at), status: (v.status as string | null) ?? null });
    }
    for (const [key, v] of latest) {
      const oid = key.split('\u0000')[0];
      (delivByOrder[oid] ||= []).push(v);
    }
    for (const k of Object.keys(delivByOrder)) delivByOrder[k].sort((a2, b2) => a2.file_name.localeCompare(b2.file_name));
  }

  const flat = (orders || []).map((o) => {
    const ti = infoById.get(String(o.talent_id));
    return { ...o, talent_name: nameById.get(String(o.talent_id)) || null,
      talent_phone: ti?.phone || null,
      talent_reach: ti ? [ti.line_user_id ? 'LINE' : '', ti.telegram_chat_id ? 'TG' : ''].filter(Boolean).join('/') : '',
      deliveries: delivByOrder[String(o.id)] || [] };
  });
  return NextResponse.json({ brief, orders: flat });
}
