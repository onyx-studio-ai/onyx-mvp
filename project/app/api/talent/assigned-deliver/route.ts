import { NextRequest, NextResponse } from 'next/server';
import { resolveTalentFromRequest } from '@/lib/talent-auth';
import { sendEmail } from '@/lib/mail';

/*
  POST /api/talent/assigned-deliver { order_id, delivery_url, file_name } — deliver
  against a DIRECTLY-ASSIGNED production order (managed casting; no quote, no client
  payment gate). Verified as the talent's own assigned order. Adds a version + flags
  the order 'delivered' for Onyx to QC in the admin order workflow.
*/
export async function POST(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id, name');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const talent = r.talent as { id: string; name: string };

  // 一次可交整批檔:files=[{delivery_url,file_name}]。相容舊的單檔 {delivery_url,file_name}。
  // 整批只算「一次交付」——版本一次插完、只發一封 produce@ 通知(不會 7 個檔轟 7 封)。
  let body: { order_id?: string; delivery_url?: string; file_name?: string; files?: { delivery_url?: string; file_name?: string }[] };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const orderId = String(body.order_id || '');
  const rawFiles = Array.isArray(body.files) && body.files.length
    ? body.files
    : [{ delivery_url: body.delivery_url, file_name: body.file_name }];
  const files = rawFiles
    .map((f) => {
      const url = String(f.delivery_url || '').slice(0, 1000);
      const name = String(f.file_name || '').slice(0, 200) || (url.split('/').pop()?.split('?')[0] || 'delivery');
      return { url, name };
    })
    .filter((f) => /^https?:\/\//i.test(f.url));
  if (!orderId || !files.length) return NextResponse.json({ error: 'order_id and at least one valid delivery_url required' }, { status: 400 });

  const { data: order } = await r.db.from('voice_orders').select('id, status, talent_id, order_number, revision_fee, revision_fee_status').eq('id', orderId).eq('talent_id', talent.id).maybeSingle();
  if (!order) return NextResponse.json({ error: 'not your assigned order' }, { status: 403 });
  if (order.status === 'completed') return NextResponse.json({ error: '已完成無法再上傳。' }, { status: 400 });
  // 有待同意的加收修改費 → 先同意才開放上傳(前端也鎖,這裡防直接打 API 繞過)
  if (order.revision_fee_status === 'pending' && (Number(order.revision_fee) || 0) > 0) {
    return NextResponse.json({ error: '本輪修改有加收費用,請先在單卡按「同意」後再上傳。' }, { status: 400 });
  }

  const { count } = await r.db.from('voice_order_versions').select('id', { count: 'exact', head: true }).eq('voice_order_id', order.id);
  const base = count || 0;
  const rows = files.map((f, i) => ({
    voice_order_id: order.id, file_url: f.url, file_name: f.name, notes: '配音員交付(指派)',
    version_number: base + i + 1, status: 'pending_review',
  }));
  const { error } = await r.db.from('voice_order_versions').insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // download_url 指向這批最後一個檔(客戶端「最新版」用)
  await r.db.from('voice_orders').update({ download_url: files[files.length - 1].url, status: 'delivered', updated_at: new Date().toISOString() }).eq('id', order.id);

  // Onyx QCs assigned deliveries in the admin order workflow (no client email — this
  // is a managed production, not a client-posted case). 整批一封信。
  const label = files.length > 1 ? `${order.order_number}(${files.length} 個檔)` : `${order.order_number}`;
  sendEmail({ category: 'PRODUCTION', to: 'produce@onyxstudios.ai', subject: `指派角色交付 · ${label}`, html: `<p>${talent.name} 交付了指派角色 ${order.order_number},共 ${files.length} 個檔。</p><p><a href="https://www.onyxstudios.ai/admin/orders">後台驗收 →</a></p>` }).catch(() => {});
  return NextResponse.json({ ok: true, count: files.length });
}

/*
  DELETE { order_id, version_id } — 配音員刪掉自己傳錯/重複的交付檔。
  只准刪「自己的單」上「還沒驗收(pending_review)」的版本;已 approved 或單已
  completed 一律擋(2026-07-17 xinyu:重傳顧冶後刪不掉舊檔)。
  刪到一個不剩 → 單退回 in_production、download_url 清掉;否則指向剩餘最新版。
*/
export async function DELETE(request: NextRequest) {
  const r = await resolveTalentFromRequest(request, 'id');
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const talent = r.talent as { id: string };

  let body: { order_id?: string; version_id?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const orderId = String(body.order_id || '');
  const versionId = String(body.version_id || '');
  if (!orderId || !versionId) return NextResponse.json({ error: 'order_id and version_id required' }, { status: 400 });

  const { data: order } = await r.db.from('voice_orders').select('id, status, talent_id').eq('id', orderId).eq('talent_id', talent.id).maybeSingle();
  if (!order) return NextResponse.json({ error: 'not your assigned order' }, { status: 403 });
  if (order.status === 'completed') return NextResponse.json({ error: '此單已完成,不能再改動交付檔。' }, { status: 400 });

  const { data: ver } = await r.db.from('voice_order_versions').select('id, status').eq('id', versionId).eq('voice_order_id', orderId).maybeSingle();
  if (!ver) return NextResponse.json({ error: '找不到這個檔案' }, { status: 404 });
  if (ver.status === 'approved') return NextResponse.json({ error: '這個檔已通過驗收,如需更換請用訊息聯絡我們。' }, { status: 400 });

  const { error } = await r.db.from('voice_order_versions').delete().eq('id', versionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: rest } = await r.db.from('voice_order_versions').select('file_url').eq('voice_order_id', orderId).order('version_number', { ascending: false }).limit(1);
  const latest = rest?.[0]?.file_url || null;
  await r.db.from('voice_orders').update({
    download_url: latest,
    ...(latest ? {} : { status: 'in_production' }),   // 刪光 = 回到待交付
    updated_at: new Date().toISOString(),
  }).eq('id', orderId);
  return NextResponse.json({ ok: true });
}
