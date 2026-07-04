import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOnly } from '@/app/api/admin/_utils/requireAdmin';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  後台請款單(admin-role only,敏感金流)。
   GET   → 列所有請款單(帶配音員名字/email),可 ?status= 過濾
   PATCH → { id, status: 'paid'|'rejected'|'pending', admin_note? } 更新;paid 時蓋 paid_at
*/
export async function GET(request: NextRequest) {
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;
  const db = getSupabaseServiceClient();
  const status = new URL(request.url).searchParams.get('status');
  let q = db.from('payout_requests')
    .select('id, talent_id, invoice_number, amount, currency, note, invoice_type, invoice_url, consent_at, status, admin_note, paid_at, created_at, talents(name, email)')
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data || [] });
}

export async function PATCH(request: NextRequest) {
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;

  let body: { id?: string; status?: string; admin_note?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const id = String(body.id || '');
  const status = body.status;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (status && !['paid', 'rejected', 'pending', 'invoice_uploaded'].includes(status)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status) { updates.status = status; updates.paid_at = status === 'paid' ? new Date().toISOString() : null; }
  if (typeof body.admin_note === 'string') updates.admin_note = body.admin_note.slice(0, 500);

  const db = getSupabaseServiceClient();
  // 狀態機把關:先讀現況,已撥款(paid)的單子不可再變更,防重複撥款 / 重蓋 paid_at / 狀態亂跳。
  const { data: cur } = await db.from('payout_requests').select('status').eq('id', id).maybeSingle();
  if (!cur) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (cur.status === 'paid') return NextResponse.json({ error: '此請款單已撥款,無法再變更。' }, { status: 400 });
  const { error } = await db.from('payout_requests').update(updates).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
