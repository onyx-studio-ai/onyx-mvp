import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-server';

/*
  POST /api/client/music-orders/[id]
    { action: 'select_demo',      demoId }        — 客戶挑一個 demo 方向(或在 demo 階段切換)
    { action: 'confirm_direction' }               — 客戶鎖定已選方向 → 開始製作
    { action: 'confirm_version',  versionId? }    — 客戶確認某個版本 → 進入定稿
    { action: 'switch_confirmed', versionId }     — 定稿階段切換要交付的版本(不改狀態)
    { action: 'request_revision', notes, overallNotes? } — 客戶要求修改(帶次數上限)

  這些動作原本在瀏覽器端直寫 music_orders / music_order_versions,但
  migration 20260223213000 的 RESTRICTIVE policy `p0_music_orders_update_service_only`
  會擋掉登入客戶(authenticated 角色)對 music_orders 的 UPDATE → 前端靜默 no-op、
  卻照跳成功 toast,整條音樂驗收流程卡死。改走 service role 後端(繞過 RLS 但自己把關):
    - owner-gate:比對呼叫者 email 是否為此訂單擁有者,否則 403。
    - 狀態機:只允許在正確的現況 status 下轉移。
    - 上限:「要求修改」在 server 端檢查 version_count < max_versions(max_versions = -1 視為無限)。
    - 錯誤處理:回傳 supabase error,不吞掉。
  對外通知信仍由既有 /api/mail/send 處理(前端在成功後續呼叫),此處不重複寄。
*/

type Version = { id: string; version_type: string | null; status: string | null };

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const db = getSupabaseServiceClient();
  const { data: userData, error: uErr } = await db.auth.getUser(token);
  const email = userData?.user?.email;
  if (uErr || !email) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  let body: { action?: string; demoId?: string; versionId?: string; notes?: string; overallNotes?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const action = body.action || '';

  // owner-gate:先撈訂單,確認擁有者(email 相符)才准動。
  const { data: order, error: oErr } = await db.from('music_orders')
    .select('id, email, status, version_count, max_versions, confirmed_version_id')
    .eq('id', id).maybeSingle();
  if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (String(order.email || '').toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: 'Not your order' }, { status: 403 });
  }

  const now = new Date().toISOString();

  // ── 選一個 demo 方向(或在 demo 階段切換所選)────────────────────────
  if (action === 'select_demo') {
    const demoId = String(body.demoId || '');
    if (!demoId) return NextResponse.json({ error: 'demoId required' }, { status: 400 });
    if (order.status !== 'demo_ready') return NextResponse.json({ error: '此訂單目前不在選擇方向階段。' }, { status: 400 });

    // 確認 demoId 確實屬於這張訂單(避免跨單污染)。
    const { data: demo } = await db.from('music_order_versions')
      .select('id').eq('id', demoId).eq('music_order_id', id).maybeSingle();
    if (!demo) return NextResponse.json({ error: '找不到此 demo。' }, { status: 404 });

    const { error: e1 } = await db.from('music_order_versions').update({ status: 'selected' }).eq('id', demoId);
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
    const { error: e2 } = await db.from('music_order_versions')
      .update({ status: 'pending_review' }).eq('music_order_id', id).neq('id', demoId);
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
    const { error: e3 } = await db.from('music_orders')
      .update({ confirmed_version_id: demoId, updated_at: now }).eq('id', id);
    if (e3) return NextResponse.json({ error: e3.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── 確認方向 → 開始製作 ────────────────────────────────────────────
  if (action === 'confirm_direction') {
    if (order.status !== 'demo_ready') return NextResponse.json({ error: '此訂單目前不在選擇方向階段。' }, { status: 400 });
    if (!order.confirmed_version_id) return NextResponse.json({ error: '請先選擇一個方向。' }, { status: 400 });
    const { error } = await db.from('music_orders')
      .update({ status: 'in_production', updated_at: now }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: 'in_production' });
  }

  // ── 確認某個版本 → 進入定稿(awaiting_final)──────────────────────
  if (action === 'confirm_version') {
    if (order.status !== 'version_ready') return NextResponse.json({ error: '此訂單目前不在確認版本階段。' }, { status: 400 });
    // versionId 可選:給了就一併切換 confirmed_version_id(客戶挑舊版本定稿),否則沿用現況。
    const versionId = String(body.versionId || '');
    if (versionId) {
      const { data: ver } = await db.from('music_order_versions')
        .select('id').eq('id', versionId).eq('music_order_id', id).maybeSingle();
      if (!ver) return NextResponse.json({ error: '找不到此版本。' }, { status: 404 });
    } else if (!order.confirmed_version_id) {
      return NextResponse.json({ error: '請先選擇要確認的版本。' }, { status: 400 });
    }
    const upd: Record<string, unknown> = { status: 'awaiting_final', awaiting_final_upload: true, updated_at: now };
    if (versionId) upd.confirmed_version_id = versionId;
    const { error } = await db.from('music_orders').update(upd).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: 'awaiting_final' });
  }

  // ── 定稿階段切換要交付的版本(不改 status)──────────────────────────
  if (action === 'switch_confirmed') {
    if (order.status !== 'awaiting_final') return NextResponse.json({ error: '此訂單目前不在定稿階段。' }, { status: 400 });
    const versionId = String(body.versionId || '');
    if (!versionId) return NextResponse.json({ error: 'versionId required' }, { status: 400 });
    const { data: ver } = await db.from('music_order_versions')
      .select('id').eq('id', versionId).eq('music_order_id', id).maybeSingle();
    if (!ver) return NextResponse.json({ error: '找不到此版本。' }, { status: 404 });
    const { error } = await db.from('music_orders')
      .update({ confirmed_version_id: versionId, updated_at: now }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── 要求修改(帶次數上限)─────────────────────────────────────────
  if (action === 'request_revision') {
    if (order.status !== 'version_ready') return NextResponse.json({ error: '此訂單目前不在可要求修改的階段。' }, { status: 400 });
    const notes = String(body.notes || '').slice(0, 2000).trim();
    if (!notes) return NextResponse.json({ error: '請說明要修改的地方。' }, { status: 400 });

    // server 端把關修改次數:max_versions = -1(Masterpiece)視為無限。
    const maxV = Number(order.max_versions);
    const usedV = Number(order.version_count) || 0;
    if (maxV >= 0 && usedV >= maxV) {
      return NextResponse.json({ error: '已達修改次數上限。' }, { status: 400 });
    }

    // 把修改意見寫到「最新的 revision 版本」上(比照原前端行為);沒有就跳過只轉狀態。
    const { data: vers } = await db.from('music_order_versions')
      .select('id, version_type, status')
      .eq('music_order_id', id)
      .eq('version_type', 'revision')
      .order('version_number', { ascending: true });
    const latest = (vers as Version[] | null)?.slice(-1)[0] || null;
    if (latest) {
      const payload: Record<string, string> = { revision_request: notes };
      const overall = String(body.overallNotes || '').slice(0, 2000).trim();
      if (overall) payload.overall_notes = overall;
      const { error: vErr } = await db.from('music_order_versions').update(payload).eq('id', latest.id);
      if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });
    }

    const { error } = await db.from('music_orders')
      .update({ status: 'in_production', updated_at: now }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: 'in_production' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
